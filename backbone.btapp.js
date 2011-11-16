$(function() {
	function assert(b) { if(!b) debugger; }

	function btfunction(url, cb) {
		debugger;
	}

	window.FetchCollection = Backbone.Collection.extend({
		initialize: function() {
			_.bind(this, 'onFetch');
		},
		onFetch: function(data) {
			for(v in data) {
				var variable = data[v];
				if(typeof variable === 'object') {
					assert(!('all' in variable));

					//an object that we need to iterate over
					var model = this.get(v);
					if(!model) {
						model = new FetchModel({id:v});
						this.add(model);
					}
					model.onFetch(variable);
				} else assert(false);
			}
		},
	});
	window.FetchModel = Backbone.Model.extend({
		initialize: function() {
			_.bind(this, 'onFetch');
		},
		onFetch: function(data) {
			for(var v in data) {
				var variable = data[v];
				//check the type of the variable...
				//function namespace
				//function definition
				//collection
				
				//special case properties to be a model with a bunch of attributes
				var param = {};
				if(v === 'properties') {
					this.onFetch(variable.all);
				} else if(typeof variable === 'object' && ('all' in variable || 'get' in variable)) {
					//collection
					var collection = this.get(v);
					if(!collection) {
						collection = new FetchCollection;
						param[v] = collection;
						this.set(param);
					}
					if('all' in variable)
						collection.onFetch(variable.all);
					if('get' in variable)
						collection.onFetch(variable.get);
				} else if(variable === '[native function]') {
					//dangle functions off the object directly
					if(!(v in this)) {
						var url = '';
						this[v] = _.bind(btfunction, url);
					}
				} else {
					//set as attributes
					param[v] = variable
					this.set(param);
				}	
			}
		},
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
				url: 'http://localhost:22907/btapp/torrent/all/',
				dataType: 'jsonp', 
				context: this, 
				success: function(data) {
					this.onFetch(data.btapp);
				}, 
				error: this.fetch, //the initial fetch is critical...so keep retrying
			});
		},
		onEvent: function(data) {
			//there are two types of events...state updates and notifications like add/delete torrent
			//handle state updates the same way we handle the initial tree building
			if('btapp' in data) {
				this.onFetch(data.btapp);
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
				url: 'http://localhost:22907/btappevents/',
				dataType: 'jsonp',
				context: this,
				success: function(data) {
					for(var i = 0; i < data.length; i++) {
						this.onEvent(data[i]);
					}
					setTimeout(this.waitForEvents, 200);
				},
				error: function() {
					this.onError();
					setTimeout(this.waitForEvents, 200);
				},
			});
		},
	});
	window.btapp = new Btapp();
});