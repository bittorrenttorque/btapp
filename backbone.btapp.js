function assert(b) { if(!b) debugger; }

$(function() {
	window.TorrentClient = Backbone.Model.extend({
		initialize: function() {
			this.host = 'http://localhost:22907/btapp/';
			this.btappCallbacks = {};
		},
		//we can't send function pointers to the torrent client server, so we'll send
		//the name of the callback, and the server can call this by sending an event with
		//the name and args back to us...we're responsible for making the call to the function 
		//when we detect this...this is similar to the way that jsonp makes ajax callbacks
		storeCallbackFunction: function(cb) {
			cb = cb || function() { debugger; };
			var str = 'bt_';
			for(var i = 0; i < 20; i++) { str += Math.floor(Math.random() * 10); }
			this.btappCallbacks[str] = cb;
			return str;
		},
		//functions are simply urls that we make ajax request to...the cb is called with the
		//result of that ajax request.
		createFunction: function(session, url) {
			return _.bind(function(cb) {
				cb = cb || function() { debugger; };
				var path = url + '(';
				for(var i = 1; i < arguments.length; i++) {
					if(i > 1) path += ',';
					//we are responsible for converting functions to variable names...
					//this will be called later via a event with a callback and arguments variables
					if(typeof arguments[i] === 'function') {
						path += this.storeCallbackFunction(arguments[i]);
					} else {
						path += arguments[i];
					}
				}
				path += ')/'
				this.query([path], session, cb, function() {debugger;});
			}, this);
		},
		query: function(query, session, cb, err) {
			//do a bit of parameter validation
			cb = cb || function() { debugger; };
			err = err || function() { debugger; };
			if(typeof query === 'string') query = [query];
			
			var url = this.host;
			var args = {};
			//add the query as a parameter
			if(query) args['queries'] = $.toJSON(query);
			//add the session as a parameter if there is one
			if(session) args['session'] = session;
			$.ajax({
				url: url,
				dataType: 'jsonp',
				context: this,
				data: args,
				success: function(data) {
					if('error' in data)	err();
					else cb(data);
				},
				error: err,
				timeout: 4000
			});
		}
	});
	window.client = new TorrentClient;	
	
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

				//special case all
				if(v == 'all') {
					this.updateState(this.session, variable, this.url + v + '/');
					continue;
				}


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
						this.bt[v] = client.createFunction(session, this.url + v);
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
			_.bindAll(this, 'onEvents', 'onFetch', 'onConnectionError', 'onTorrentStatus');
			this.fetch();
			
			this.bind('torrentStatus', this.onTorrentStatus);
		},
		onConnectionError: function() {
			console.log('connection lost...retrying...');
			this.clearState();
			this.fetch();
		},
		onFetch: function(data) {
			assert('btapp' in data);
			this.updateState(data.session, data.btapp, 'btapp/');
			this.setEvents();
			this.waitForEvents(data.session);
		},
		fetch: function() {
			client.query(['btapp/torrent/all/*/properties/all/','btapp/torrent/all/*/file/all/','btapp/events/'], null, this.onFetch, this.onConnectionError);
		},
		onEvent: function(data) {
			//there are two types of events...state updates and callbacks
			//handle state updates the same way we handle the initial tree building
			if('btapp' in data) {
				this.updateState(this.session, data.btapp, 'btapp/');
			} else if('callback' in data && 'arguments' in data) {
				window.btappCallbacks[data.callback](data.arguments);
			} else assert(false);
		},
		onEvents: function(time, session, data) {
			console.log(((new Date()).getTime() - time) + ' ms - ' + JSON.stringify(data).length + ' bytes');
			for(var i = 0; i < data.length; i++) {
				this.onEvent(data[i]);
			}
			setTimeout(_.bind(this.waitForEvents, this, session), 1000);
		},
		waitForEvents: function(session) {
			client.query(null, session, _.bind(this.onEvents, this, (new Date()).getTime(), session), this.onConnectionError);
		},
		onTorrentStatus: function(args) {
			if(args.state == -1 && args.hash) {
				console.log('torrentStatus(' + args.hash + ')');
				var torrents = this.get('torrent').get('all');
				var torrent = torrents.get(args.hash);
				if(torrent) {
					torrent.clearState();
				}
				torrents.unset(args.hash);
			}
		},
		setEvents: function() {
			//we assume that we just filled in the events information...we desperately want to
			//set these so that get all the callbacks from the client...what we want to do is
			//just have the default event handler trigger an event that has the same name as the event
			//so if you're using the model you can just do something like 
			//btapp.bind('clientMessage', onClientMessage) and your handler will receive the info blog
			//regarding that type of event...it also multiplexes the event handling very nicely
			for(var ev in this.get('events').attributes) {
				this.get('events').bt['set'](
					_.bind(function(ev) { console.log('set(' + ev + ')'); }, this, ev),
					ev, 
					_.bind(this.trigger, this, ev)
				);
			}
		}
	});
	window.btapp = new Btapp();
});