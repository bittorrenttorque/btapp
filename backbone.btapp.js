//i miss __asm int 3...this is why c/c++ devs shouldn't write javascript
function assert(b) { if(!b) debugger; }

$(function() {
	/**
		TorrentClient provides a very thin wrapper around the web api
		It should facilitate finding the correct port and connecting if
		necessary to the user computer through falcon...by default uses localhost
		
		TorrentClient is responsible for the mapping between functions
		passed to as arguments and the string that proxies them to the client
		
		TorrentClient is responsible for creating functions that wrap around
		specific urls that can can be dangled off of models so that when we call
		stop on a torrent file, the torrent specific url is accessed without any
		effort on the part of the client
	**/
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
	//this is the TorrentClient singleton that should be used
	window.client = new TorrentClient;
	
	/**
		BtappCollection is a collection of objects in the client...
		currently this can only be used to represent the list of torrents,
		then within the torrents, their list of files...this will eventually
		be used for rss feeds, etc as well.
	**/
	window.BtappCollection = Backbone.Collection.extend({
		initialize: function() {
			_.bindAll(this, 'clearState', 'updateState');
			this.initializeValues();
		},
		initializeValues: function() {
			this.url = '';
			this.session = null;
		},
		clearState: function() {
			this.each(function(model) {
				model.clearState();
			});
			this.reset();
			this.initializeValues();
		},
		updateState: function(session, data, url) {
			this.session = session;
			this.url = url;
			for(var v in data) {
				var variable = data[v];

				//special case all
				if(v == 'all') {
					this.updateState(this.session, variable, this.url + v + '/');
					continue;
				}
				
				if(typeof variable === 'object') {
					//don't recreate a variable we already have...just update it
					var model = this.get(v);
					if(!model) {
						model = new BtappModel({'id':v});
						this.add(model);
					}
					model.updateState(this.session, variable, this.url + v + '/');
				}
			}
		}
	});
	
	/**
		BtappModel is the base model for most things in the client
		a torrent is a BtappModel, a file is a BtappModel, properties that 
		hang off of most BtappModels is also a BtappModel...both BtappModel
		and BtappCollection objects are responsible for taking the json object
		that is returned by the client and turning that into attributes/functions/etc
		
		BtappModel and BtappCollection both support clearState and updateState
	**/	
	window.BtappModel = Backbone.Model.extend({
		initialize: function() {
			_.bindAll(this, 'clearState', 'updateState');
			this.initializeValues();
		},
		initializeValues: function() {
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
			this.clear();
			this.initializeValues();
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
						if(v == 'torrent' || v == 'file') {
							model = new BtappCollection;
						} else {
							model = new BtappModel;
						}
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
		}
	});

	/**
		Btapp is the root of the client objects' tree...this mirrors the original api
		where document.btapp was the root of everything. generally, this api attempts to be
		as similar as possible to that one...
		
		BEFORE: btapp.torrent.get('XXX').file.get('XXX').properties.get('name');
		AFTER: btapp.get('torrent').get('XXX').get('file').get('XXX').get('properties').get('name');
		
		the primary difference is that in the original you got the state at that exact moment, where
		we now simply keep the backbone objects up to date (by quick polling and updating as diffs are returned)
		so you can query at your leisure.
		
		EVENTS: there are the following events
			appDownloadProgress
			filesDragDrop
			appStopping
			appUninstall
			clientMessage
			commentNotice
			filesAction
			rssStatus
			torrentStatus
			
		torrentStatus is used internally to keep our objects up to date, but that and clientMessage are really the only
		events that are generally used...these trigger events when they are received by the base object, so to listen in
		on torrentStatus events, simply provide a callback to btapp.bind('torrentStatus', callback_func)
	**/		
	window.Btapp = BtappModel.extend({
		initialize: function() {
			BtappModel.prototype.initialize.call(this);
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