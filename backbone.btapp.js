/**
	Backbone.btapp.js 0.1
	(c) 2012 Patrick Williams, BitTorrent Inc.
	May be freely distributed under the MIT license.

	Welcome to backbone.btapp.js
	
	This should provide a clean javascript layer above the utorrent/bittorrent
	webui layer (the web interface to a client). It is intended to abstract away 
	everything but the objects and the functions that can be called on them. 
	There's no need for someone writing	a web app that interacts with the client to 
	constantly be doing diffs to see what has changed. In addition, calling long specific 
	urls to call a single function on a torrent object is pretty painful, so I added 
	functions that dangle off of the objects (in the bt object) that will call the urls 
	that will acheive the desired effect and will also handle passing functions as arguments...
	this is similar to soap or rpc...so callbacks should *just work*...in fact, we internally 
	rely on this as the	torrentStatus event function is set and the used to keep our models up to date
**/

//i miss __asm int 3...this is why c/c++ devs have a hard time writing javascript
function assert(b) { if(!b) debugger; }

(function($) {
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
		initialize: function(attributes) {
			//default to port 10000...on localhost we should start looking there
			var port = attributes.port || 10000;
			var scheme = attributes.scheme || 'http';
			var host = attributes.host || 'localhost';
			this.set({'port': port,'scheme': scheme, 'host': host});
			this.url = this.get('scheme') + '://' + this.get('host') + ':' + this.get('port') + '/btapp/';
			this.btappCallbacks = {};
		},
		//we can't send function pointers to the torrent client server, so we'll send
		//the name of the callback, and the server can call this by sending an event with
		//the name and args back to us...we're responsible for making the call to the function 
		//when we detect this...this is similar to the way that jsonp makes ajax callbacks
		storeCallbackFunction: function(cb) {
			cb = cb || function() {};
			var str = 'bt_';
			for(var i = 0; i < 20 || (str in this.btappCallbacks); i++) { str += Math.floor(Math.random() * 10); }
			this.btappCallbacks[str] = cb;
			return str;
		},
		//functions are simply urls that we make ajax request to...the cb is called with the
		//result of that ajax request.
		createFunction: function(session, url) {
			assert(session);
			var func = _.bind(function(cb) {
				cb = cb || function() {};
				var path = url + '(';
				var args = [];
				for(var i = 1; i < arguments.length; i++) {
					//we are responsible for converting functions to variable names...
					//this will be called later via a event with a callback and arguments variables
					if(typeof arguments[i] === 'function') {
						args.push(this.storeCallbackFunction(arguments[i]));
					} else {
						args.push(arguments[i]);
					}
				}
				path += encodeURIComponent($.toJSON(args));
				path += ')/';
				console.log('CUSTOM FUNCTION: ' + path);
				this.query('function', [path], session, cb, function() {});
			}, this);
			func.valueOf = function() { return url; }
			return func;
		},
		query: function(type, queries, session, cb, err) {
			assert(type == "update" || type == "state" || type == "function");
			//do a bit of parameter validation
			cb = cb || function() {};
			err = err || function() {};
			if(typeof queries === 'string') queries = [queries];
			
			var args = {};
			args['type'] = type;
			//add the queries as a parameter
			if(queries) args['queries'] = $.toJSON(queries);
			//add the session as a parameter if there is one
			if(session) args['session'] = session;
			$.ajax({
				url: this.url,
				dataType: 'jsonp',
				context: this,
				data: args,
				success: function(data) {
					if(!(typeof data === 'object') || 'error' in data)	err();
					else cb(data);
				},
				error: err,
				timeout: 3000
			});
		}
	});
	
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
					this.updateState(this.session, variable, url + escape(v) + '/');
					continue;
				}
				
				if(typeof variable === 'object') {
					//don't recreate a variable we already have...just update it
					var model = this.get(v);
					if(!model) {
						model = new BtappModel({'id':v});
						model.client = this.client;
						model.updateState(this.session, variable, url + escape(v) + '/');
						this.add(model);
					} else {
						model.updateState(this.session, variable, url + escape(v) + '/');
					}
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
			
			this.bind('change', _.bind(function() {
				var attrs = this.attributes;
				var prev = this.previousAttributes();
				for(var a in attrs) {
					if(!(a in prev)) {
						this.trigger('add:' + a, attrs[a]);
						this.trigger('add', attrs[a]);
					}
				}
				for(var p in prev) {
					if(!(p in attrs)) {
						this.trigger('remove:' + a, prev[p]);
						this.trigger('remove', prev[p]);
					}
				}
			}, this));
		},
		initializeValues: function() {
			this.bt = {};
			this.url = null;
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
			if(!this.url) this.url = url;
			for(var v in data) {
				var variable = data[v];
				var param = {};
				
				//special case all
				if(v == 'all') {
					this.updateState(this.session, variable, url + escape(v) + '/');
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
						model.client = this.client;
					}
					model.updateState(this.session, variable, url + escape(v) + '/');
					param[v] = model;
					this.set(param,{server:true});
				} else if(variable === '[native function]') {
					if(!(v in this.bt)) {
						this.bt[v] = this.client.createFunction(session, url + escape(v));
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
			//if one of the options is server: true, then we shouldn't notify the
			//server about the set request...otherwise this is likely the web app
			//that is setting a variable and we should notify the client so it can
			//update appropriately...in that case don't update our own models...they
			//will be updated by the server if something in fact changes in the client
			if(	(!options || !('server' in options) || !options['server']) &&
				(this.bt && 'set' in this.bt)) {
				var callback = (options && 'callback' in options) ? 
					options['callback'] : 
					function() { debugger; };
				for(var a in attributes) {
					this.bt['set'](callback, a, attributes[a]);
				}
			} else {
				Backbone.Model.prototype.set.call(this, attributes, options);
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
		initialize: function(attributes) {
			//call the base model initializer
			BtappModel.prototype.initialize.call(this);
			//bind stuff
			_.bindAll(this, 'onEvents', 'onFetch', 'onConnectionError', 'onTorrentStatus');
			this.bind('torrentStatus', this.onTorrentStatus);
			this.bind('add:events', this.setEvents);
			//in the future, the creator of Btapp should be able to specify the filters they want
			//we can provide some defaults for people that just want torrents/files/rss/etc
			this.queries = [
				'btapp/stash/all/',
				'btapp/torrent/all/*/properties/all/',
				'btapp/torrent/all/*/file/all/',
				'btapp/events/',
				'btapp/add/',
				'btapp/dht/'
			];
			
			this.client = new TorrentClient(attributes);		
			
			//do this after everything has been setup...we're ready for info from the client
			this.fetch();
		},
		onConnectionError: function() {
			console.log('connection lost...retrying...');
			this.clearState();
			this.fetch();
		},
		onFetch: function(data) {
			assert('session' in data);
			this.waitForEvents(data.session);
		},
		fetch: function() {
			this.client.query('state', this.queries, null, this.onFetch, this.onConnectionError);
		},
		onEvent: function(session, data) {
			//there are two types of events...state updates and callbacks
			//handle state updates the same way we handle the initial tree building
			if('btapp' in data) {
				this.trigger('update', data.btapp);
				this.updateState(session, data.btapp, 'btapp/');
			} else if('callback' in data && 'arguments' in data) {
				this.client.btappCallbacks[data.callback](data.arguments);
			} else assert(false);
		},
		onEvents: function(time, session, data) {
			console.log(((new Date()).getTime() - time) + ' ms - ' + JSON.stringify(data).length + ' bytes');
			for(var i = 0; i < data.length; i++) {
				this.onEvent(session, data[i]);
			}
			setTimeout(_.bind(this.waitForEvents, this, session), 1000);
		},
		waitForEvents: function(session) {
			this.client.query('update', null, session, _.bind(this.onEvents, this, (new Date()).getTime(), session), this.onConnectionError);
		},
		onTorrentStatus: function(args) {
			if(args.state == -1 && args.hash) {
				console.log('torrentStatus(' + args.hash + ')');
				var torrents = this.get('torrent');
				var torrent = torrents.get(args.hash);
				if(torrent) {
					torrent.clearState();
				}
				torrents.remove(torrent);
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
				var arguments = {};
				arguments[ev] = _.bind(this.trigger, this, ev);
				var options = {'callback':_.bind(function(ev) { console.log('set(' + ev + ')'); }, this, ev)};
				this.get('events').set(arguments, options);
			}
		},
	});
})(jQuery);
