$(function() {
	function assert(b) { if(!b) debugger; }

	var host = 'http://localhost:22907/';

	//we can't send function pointers to the torrent client server, so we'll send
	//the name of the callback, and the server can call this by sending an event with
	//the name and args back to us...we're responsible for making the call to the function 
	//when we detect this...this is similar to the way that jsonp makes ajax callbacks
	window.btappCallbacks = {};
	function storeCallbackFunction(cb) {
		var str = 'bt_';
		for(var i = 0; i < 20; i++) { str += Math.floor(Math.random() * 10); }
		window.btappCallbacks[str] = cb;
		return str;
	}
	
	//functions are simply urls that we make ajax request to...the cb is called with the
	//result of that ajax request.
	function createFunction(session, url) {
		return function(cb) {
			var path = host + url + '(';
			for(var i = 1; i < arguments.length; i++) {
				if(i > 1) path += ',';
				//we are responsible for converting functions to variable names...
				//this will be called later via a event with a callback and arguments variables
				if(typeof arguments[i] === 'function') {
					path += storeCallbackFunction(arguments[i]);
				} else {
					path += arguments[i];
				}
			}
			path += ')/?session=' + session;
			console.log(path);
			$.ajax({
				url: path,
				dataType: 'jsonp', 
				success: cb,
				error: cb
			});		
		};
	}
	
	window.FetchModel = Backbone.Model.extend({
		initialize: function() {
			_.bindAll(this, 'clearState', 'updateState');
			this.bt = {};
			this.url = '';
			this.session = null;
		},
		clearState: function() {
			for(a in this.attributes) {
				var attribute = this.attributes[a];
				if(typeof attribute === 'object' && 'clearState' in attribute) {
					attribute.clearState();
				}
			}
			this.bt = {};
			this.clear();
		},
		updateState: function(session, data, url) {
			this.session = session;
			this.url = url;
			for(var v in data) {
				var variable = data[v];
				var param = {};
				if(typeof variable === 'object') {
					//don't recreate a variable we already have...just update it
					var model = this.get(v);
					if(!model) {
						model = new FetchModel;
					}
					model.updateState(this.session, variable, this.url + v + '/');
					param[v] = model;
					this.set(param,{server:true});
				} else if(variable === '[native function]') {
					if(!(v in this.bt)) {
						this.bt[v] = createFunction(session, this.url + v);
						this.trigger('change');
					}
				} else {
					//set as attributes
					param[v] = variable;
					this.set(param, {server:true});
				}	
			}
		},
		set: function(attributes, options) {
			Backbone.Model.prototype.set.call(this, attributes, options);
			//TODO: when server isn't set assume that the change we caused by the user
			//in this case do a set to the server to update the value of the property
			//if(!options || !('server' in options) || !options['server']) {
		}
	});

	window.Btapp = FetchModel.extend({
		initialize: function() {
			FetchModel.prototype.initialize.call(this);
			_.bindAll(this, 'onEvents', 'onFetch', 'onInitializeSession');
			this.initializeSession();
		},
		queryClient: function(query, cb) {
			$.ajax({
				url: host + query,
				dataType: 'jsonp', 
				context: this, 
				success: function(data) {
					if('error' in data)	this.connectionError();
					else cb(data);
				},
				error: function(jqXHR, textStatus, errorThrown) {
					this.connectionError();
				},
				timeout: 4000
			});
		},
		connectionError: function() {
			console.log('connection lost...retrying...');
			this.clearState();
			this.initializeSession();
		},
		onInitializeSession: function(data) {
			assert('session' in data);
			this.session = data.session
			console.log('connection established...');
			this.fetch(data.session);
		},
		initializeSession: function() {
			console.log('initializing connection');
			this.queryClient('btappinit/', this.onInitializeSession);
		},
		onFetch: function(data) {
			assert('btapp' in data);
			this.updateState(this.session, data.btapp, 'btapp/');
			this.setEvents();
			this.waitForEvents();
		},
		fetch: function(session) {
			this.queryClient('btapp/?session=' + this.session, this.onFetch);
		},
		onEvent: function(data) {
			//there are two types of events...state updates and callbacks
			//handle state updates the same way we handle the initial tree building
			if('btapp' in data) {
				this.updateState(this.session, data.btapp, 'btapp/');
			} else if('callback' in data && 'arguments' in data) {
				console.log('CALLBACK - ' + data.callback + '(' + $.toJSON(data.arguments) + ')');
				window.btappCallbacks[data.callback](data.arguments);
			} else {
				//check for torrent status events...the only one that isn't captured by update gui
				//is torrent deletes...so check here
				if('hash' in data && 'state' in data) {
					var torrents = window.btapp.get('torrent');
					torrents.remove(torrents.get(data.hash));
				}
			}
		},
		onEvents: function(data) {
			for(var i = 0; i < data.length; i++) {
				this.onEvent(data[i]);
			}
			setTimeout(_.bind(this.waitForEvents, this), 250);
		},
		waitForEvents: function() {
			this.queryClient('btappevents/?session=' + this.session, this.onEvents);
		},
		setEvents: function() {
			//we assume that we just filled in the events information...we desperately want to
			//set these so that get all the callbacks from the client...what we want to do is
			//just have the default event handler trigger an event that has the same name as the event
			//so if you're using the model you can just do something like 
			//btapp.bind('clientMessage', onClientMessage) and your handler will receive the info blog
			//regarding that type of event...it also multiplexes the event handling very nicely
			for(var ev in this.get('events').get('all').attributes) {
				this.get('events').bt['set'](null, ev, _.bind(this.trigger, this, ev));
			}
			
			//we can take advantage of this internally by binding to the torrentStatus event...which we
			//need to keep an accurate picture of the torrents
			this.bind('torrentStatus', function(args) {
				if(args.state == -1 && args.hash) {
					var torrents = this.get('torrent').get('all');
					var torrent = torrents.get(args.hash);
					if(torrent) torrent.clearState();
					torrents.unset(args.hash);
				}
			});
		}
	});
	window.btapp = new Btapp();
});