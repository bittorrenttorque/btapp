$(function() {
	function assert(b) { if(!b) debugger; }

	var host = 'http://localhost:22907/';

	function createFunction(url) {
		return function(cb) {
			var path = host + url + '(';
			for(var i = 1; i < arguments.length; i++) {
				if(i > 1) path += ',';
				path += arguments[i];
			}
			path += ')/';
			console.log(path);
			$.ajax({
				url: path,
				dataType: 'jsonp', 
				success: cb,
				error: cb
			});		
		};
	}
	
	//in order for us to put data structures into a backbone collection every child must be an object
	function validCollection(collection) {
		for(c in collection) {
			if(typeof collection[c] === 'object') continue;
			else return false;
		}
		return true;
	}

	window.FetchCollection = Backbone.Collection.extend({
		initialize: function() {
			_.bind(this, 'onFetch');
		},
		onFetch: function(data, url) {
			for(v in data) {
				var variable = data[v];
				
				if(variable === 'Not yet supported') continue;
				
				if(typeof variable === 'object') {
					assert(!('all' in variable));

					//an object that we need to iterate over
					var model = this.get(v);
					if(!model) {
						model = new FetchModel({id:v});
						this.add(model);
					}
					model.onFetch(variable, url + v + '/');
				} else assert(false);
			}
		}
	});
	window.FetchModel = Backbone.Model.extend({
		initialize: function() {
			_.bind(this, 'onFetch');
		},
		onFetch: function(data, url) {
			for(var v in data) {
				var variable = data[v];

				if(variable === 'Not yet supported') continue;

				//check the type of the variable...
				//function namespace
				//function definition
				//collection
				
				//special case properties to be a model with a bunch of attributes
				var param = {};
				if(v === 'properties') {
					this.onFetch(variable.all, url + v + '/all/');
				} else if(typeof variable === 'object' && ('all' in variable && validCollection(variable.all))) {
					//collection
					var collection = this.get(v);
					if(!collection) {
						collection = new FetchCollection;
						param[v] = collection;
						this.set(param);
					}
					collection.onFetch(variable.all, url + v + '/all/');
				} else if(variable === '[native function]') {
					//dangle functions off the object directly
					if(!(v in this)) {
						this[v] = createFunction(url + v);
						this.trigger('change');
					}
				} else {
					//set as attributes
					param[v] = variable
					this.set(param);
				}	
			}
		}
	});

	window.Btapp = FetchModel.extend({
		initialize: function() {
			_.bindAll(this, 'fetch', 'waitForEvents');
			this.fetch();
			this.waitForEvents();
		},
		onError: function() {
			debugger;
		},
		fetch: function() {
			$.ajax({
				url: host + 'btapp/',
				dataType: 'jsonp', 
				context: this, 
				success: function(data) {
					this.onFetch(data.btapp, 'btapp/');
				}, 
				error: this.fetch //the initial fetch is critical...so keep retrying
			});
		},
		onEvent: function(data) {
			//there are two types of events...state updates and notifications like add/delete torrent
			//handle state updates the same way we handle the initial tree building
			if('btapp' in data) {
				this.onFetch(data.btapp, 'btapp/');
			} else {
				//check for torrent status events...the only one that isn't captured by update gui
				//is torrent deletes...so check here
				if('hash' in data && 'state' in data) {
					var torrents = window.btapp.get('torrent');
					torrents.remove(torrents.get(data.hash));
				}
			}
		},
		waitForEvents: function() {
			$.ajax({
				url: host + 'btappevents/',
				dataType: 'jsonp',
				context: this,
				success: function(data) {
					for(var i = 0; i < data.length; i++) {
						this.onEvent(data[i]);
					}
					setTimeout(this.waitForEvents, 1000);
				},
				error: function() {
					this.onError();
					setTimeout(this.waitForEvents, 1000);
				}
			});
		}
	});
	window.btapp = new Btapp();
});