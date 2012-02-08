// Backbone.btapp.js 0.1
// (c) 2012 Patrick Williams, BitTorrent Inc.
// Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0

// Welcome to backbone.btapp.js

// This should provide a clean javascript layer above the utorrent/bittorrent
// webui layer (the web interface to a client). It is intended to abstract away 
// everything but the objects and the functions that can be called on them. 
// There's no need for someone writing	a web app that interacts with the client to 
// constantly be doing diffs to see what has changed. In addition, calling long specific 
// urls to call a single function on a torrent object is pretty painful, so I added 
// functions that dangle off of the objects (in the bt object) that will call the urls 
// that will acheive the desired effect and will also handle passing functions as arguments...
// this is similar to soap or rpc...so callbacks should *just work*...in fact, we internally 
// rely on this as the	torrentStatus event function is set and the used to keep our models up to date

// some of us are lost in the world without __asm int 3;
function assert(b) { if(!b) debugger; }

(function() {
	// Torrent Client (base functionality for Falcon/Local Torrent Clients)
	// -------------

	// TorrentClient provides a very thin wrapper around the web api
	// It should facilitate finding the correct port and connecting if
	// necessary to the user computer through falcon...by default uses localhost
	
	// TorrentClient is responsible for the mapping between functions
	// passed to as arguments and the string that proxies them to the client
	
	// TorrentClient is responsible for creating functions that wrap around
	// specific urls that can can be dangled off of models so that when we call
	// stop on a torrent file, the torrent specific url is accessed without any
	// effort on the part of the client
	
	// Keep in mind that because jsonp won't time out naturally, we impose our own
	// timeouts...this can lead to some less than desirable code :(
	
	window.TorrentClient = Backbone.Model.extend({
		initialize: function(attributes) {
			this.btappCallbacks = {};
		},
		// We can't send function pointers to the torrent client server, so we'll send
		// the name of the callback, and the server can call this by sending an event with
		// the name and args back to us. We're responsible for making the call to the function 
		// when we detect this. This is the same way that jquery handles ajax callbacks.
		storeCallbackFunction: function(cb) {
			cb = cb || function() {};
			var str = 'bt_';
			for(var i = 0; i < 20 || (str in this.btappCallbacks); i++) { str += Math.floor(Math.random() * 10); }
			this.btappCallbacks[str] = cb;
			return str;
		},
		// We expect function signatures that come from the client to have a specific syntax
		isFunctionSignature: function(f) {
			return f.match(/\[native function\](\([^\)]*\))+/) ||
					f.match(/\[nf\](\([^\)]*\))+/);
		},
		// Seeing as we're interfacing with a strongly typed language c/c++ we need to 
		// ensure that our types are at least close enough to coherse into the desired types
		// takes something along the lines of "[native function](string,unknown)(string)".
		validateArguments: function(functionValue, variables) {
			return true;
			assert(typeof functionValue === 'string' && typeof variables === 'object');
			var signatures = functionValue.match(/\(.*?\)/g);
			return _.any(signatures, function(signature) {
				var signature = signature.match(/\w+/g) || []; //["string","unknown"]
				return _.all(signature, function(type,index) { 
					switch(typeof type) {
						//Most of these types that the client sends up match the typeof values of the javascript
						//types themselves so we can do a direct comparison
						case 'number':
						case 'string':
						case 'boolean':
						case 'array':
							return typeof variables[index] === type;
						//In the case of unknown, we have no choice but to trust the argument as
						//the client hasn't specified what type it should be
						case 'unknown':
							return true;
						case 'dispatch':
							return typeof variables[index] === 'array' || typeof variables[index] === 'function';
					}
					//has the client provided a type that we weren't expecting?
					assert(false);
				});
			});
		},
		// Functions are simply urls that we make ajax request to. The cb is called with the
		// result of that ajax request.
		createFunction: function(session, url, signatures) {
			assert(session);
			var func = _.bind(function(cb) {
				assert(arguments.length >= 1); //they at least need to provide the callback
				assert(typeof cb === 'function');
				var path = url + '(';
				var args = [];
				
				// Lets do a bit of validation of the arguments that we're passing into the client
				// unfortunately arguments isn't a completely authetic javascript array, so we'll have
				// to "splice" by hand. All this just to validate the correct types! sheesh...
				var native_args = [];
				for(var i = 1; i < arguments.length; i++) native_args.push(arguments[i]);
				// This is as close to a static class function as you can get in javascript i guess
				// we should be able to use verifySignaturesArguments to determine if the client will
				// consider the arguments that we're passing to be valid
				if(!TorrentClient.prototype.validateArguments.call(this, signatures, native_args)) {
					alert(signatures + ' cannot accept ' + jQuery.toJSON(native_args));
					return;
				}
				

				for(var i = 1; i < arguments.length; i++) {
					// We are responsible for converting functions to variable names...
					// this will be called later via a event with a callback and arguments variables
					if(typeof arguments[i] === 'function') {
						args.push(this.storeCallbackFunction(arguments[i]));
					} else {
						args.push(arguments[i]);
					}
				}
				path += encodeURIComponent(jQuery.toJSON(args));
				path += ')/';
				console.log('CUSTOM FUNCTION: ' + path);
				this.query('function', [path], session, cb, function() {});
			}, this);
			func.valueOf = function() { return signatures; };
			return func;
		},
		query: function(type, queries, session, cb, err) {
			assert(type == "update" || type == "state" || type == "function");
			cb = cb || function() {};
			err = err || function() {};
			// Handle either an array of strings or just a single query.
			if(typeof queries === 'string') queries = [queries];
			
			var args = {};
			args['type'] = type;
			if(queries) args['queries'] = jQuery.toJSON(queries);
			if(session) args['session'] = session;
			
			var success_callback = function(data) { 
				if (data == 'invalid request') {
					alert('please close utorrent and bittorrent and share etc...');
				} else if(!(typeof data === 'object') || 'error' in data) {
					err();
				} else {
					cb(data);
				}
			};
			this.send_query(args, success_callback, err);
		}
	});

	// Falcon Torrent Client
	// -------------
	
	// Falcon torrent client connections are a bit more involved than a client on the local machine
	// We have additional javascript dependencies that are substantial enough that we don't load them
	// unless you open a falcon connection. In addition we have some handshaking with the falcon proxy
	// that we need to wait for. 
	var falcon_initialized = false;
	window.FalconTorrentClient = TorrentClient.extend({
		initialize: function(attributes) {
			TorrentClient.prototype.initialize.call(this, attributes);

			assert(typeof attributes === 'object' && (('username' in attributes && 'password' in attributes) || 'remote_data' in attributes));
			this.username = attributes.username;
			this.password = attributes.password;
			if ('remote_data' in attributes) {
			    this.remote_data = attributes.remote_data;
			}
			if ('login_success' in attributes) {
			    this.login_success = attributes.login_success;
			}
			if ('login_error' in attributes) {
			    this.login_error = attributes.login_error;
			}
			if ('login_progress' in attributes) {
			    this.login_progress = attributes.login_progress;
			}
			
			// We only have to load all those expensive js dependencies once...
			// We can just skip straight to the good stuff (signing in) if we've
			// done this previously.
			if(falcon_initialized) {
				_.defer(_.bind(this.reset, this));
				return;
			}
			
			console.log('initializing falcon client');
			console.log('loading falcon external dependencies');
			
			// If we choose to use falcon we need this specific global config variable defined
			window.config = {
				srp_root:'https://remote-staging.utorrent.com'
			};
			
			var jsload = 'https://remote-staging.utorrent.com/static/js/jsloadv2.js?v=0.57';
			jQuery.getScript(jsload, _.bind(function(data, textStatus) {
				console.log('loaded ' + jsload);
				function create_tags(list) {
					var tags = [];
					var deps = [];
					for (var i = 0; i < list.length - 1; i++) {
						var current = list[i];
						tags.push( { name: current } );
						deps.push( current );
					}
					tags.push( { name: list[list.length-1],
					requires: deps } );
					return tags;
				}
				dependencies = [
					'falcon/deps/SHA-1.js',
					'falcon/deps/jsbn.js',
					'falcon/deps/jsbn2.js',
					'falcon/deps/sjcl.js',
					'falcon/falcon.js',
					'falcon/falcon.encryption.js',
					'falcon/falcon.api.js',
					'falcon/falcon.session.js'
				];
				var tags = create_tags(dependencies);
				(new JSLoad(tags, "https://remote-staging.utorrent.com/static/js/")).load(['falcon/falcon.session.js'], _.bind(function() {
					if (this.remote_data) {
						this.session = new falcon.session( { client_data: this.remote_data } );
						this.falcon = this.session.api;
						falcon_initialized = true;
						this.trigger('connected');
					} else {
						console.log('falcon dependencies loaded...begin exchanging btapp webui information');
						falcon_initialized = true;
						this.reset();
					}
				}, this));
			}, this));
		},
		connect: function() {
			assert(!this.falcon);
			// set up some connection variables
			var opts = {
				success: _.bind(function(session) {
						    if (this.login_success) { this.login_success(session); }
					console.log('raptor connected successfully');
					this.falcon = this.session.api;
					this.trigger('connected');
				}, this),
				error: _.bind(function(xhr, status, data) {
						  if (this.login_error) { this.login_error(xhr, status, data); }
					      }, this)
			};
			this.session = new falcon.session;
			this.session.negotiate(this.username,this.password, { success: opts.success, error: opts.error, progress: this.login_progress } );
		},
		// This is the Btapp object's gateway to the actual client requests. These requests look slightly
		// different than those headed to a local client because they are encrypted.
		send_query: function(args, cb, err) {
			assert(this.falcon);
			
			this.falcon.request(
				'POST', 
				'/client/gui/', 
				{'btapp':'backbone.btapp.js'}, 
				args, 
				function(data) {
					assert('build' in data);
					assert('result' in data);
					cb(data.result);
				},
				_.bind(function() { 
					console.log('falcon request failed');
					err();
					this.reset();
				}, this),
				{}
			);
		},
		reset: function() {
			this.falcon = null;
			this.connect();
		}
	});
	
	// Local Torrent Client
	// -------------

	// For clients on the local machine very little setup is neeeded. We have a known port that
	// the client listens on, so we can just make requests to that. We can also immediately
	// consider ourselves "connected", which indicates that we're connected to the machine
	// (for falcon clients we may not ever reach the client even if it is logged into falcon)
	window.LocalTorrentClient = TorrentClient.extend({
		initialize: function(attributes) {
			TorrentClient.prototype.initialize.call(this, attributes);
			this.url = 'http://localhost:10000/btapp/';
			this.btapp = attributes.btapp;
			this.reset();
			jQuery.getScript(
				'https://raw.github.com/pwmckenna/btapp_plugin/master/plugin.btapp.js', 
				function(data, textStatus) {
					//now that the plugin code is loaded it can take it from here.
				}
			);
		},
		send_query: function(args, cb, err) {
			jQuery.ajax({
				url: this.url,
				dataType: 'jsonp',
				context: this,
				data: args,
				success: cb,
				error: err,
				timeout: 5000
			});
		},
		reset: function() {
			_.defer(_.bind(this.trigger, this, 'connected'));
		}		
	});	
	
	// BtappCollection
	// -------------
	
	// BtappCollection is a collection of objects in the client...
	// currently this can only be used to represent the list of torrents,
	// then within the torrents, their list of files...this will eventually
	// be used for rss feeds, etc as well.

	// BtappModel and BtappCollection both support clearState and updateState
	window.BtappCollection = Backbone.Collection.extend({
		initialize: function(models, options) {
			Backbone.Collection.prototype.initialize.apply(this, arguments);
			_.bindAll(this, 'destructor', 'clearState', 'updateState');
			this.initializeValues();
		},
		initializeValues: function() {
			this.url = '';
			this.session = null;
			this.bt = {};
		},
		destructor: function() {
			this.trigger('destroy');
		},
		clearState: function() {
			this.each(function(model) {
				model.clearState();
			});
			this.destructor();
			this.reset();
			this.initializeValues();
		},
		updateState: function(session, add, remove, url) {
			var time = (new Date()).getTime();	
			this.session = session;
			if(!this.url) {
				this.url = url;
				this.trigger('change');
			}
			
			add = add || {};
			remove = remove || {};
			
			// Iterate over the diffs that came from the client to see what has been added (only in add),
			// removed (only in remove), or changed (old value in remove, new value in add)
			for(var uv in remove) {
				var added = add[uv];
				var removed = remove[uv];
				var v = escape(uv);
				var childurl = url + v + '/';

				
				// Elements that are in remove aren't necessarily being removed,
				// they might alternatively be the old value of a variable that has changed
				if(!added) {
					// Most native objects coming from the client have an "all" layer before their variables,
					// There is no need for the additional layer in javascript so we just flatten the tree a bit.
					if(v == 'all') {
						this.updateState(this.session, added, removed, childurl);
						continue;
					}

					// We only expect objects and functions to be added to collections
					if(typeof removed === 'object') {
						var model = this.get(childurl);
						assert(model);
						model.updateState(session, added, removed, childurl);
						this.remove(model);
					}			
				}
			}
			for(var uv in add) {
				var added = add[uv];
				var removed = remove[uv];
				var v = escape(uv);
				var childurl = url + v + '/';

				// Most native objects coming from the client have an "all" layer before their variables,
				// There is no need for the additional layer in javascript so we just flatten the tree a bit.
				if(v == 'all') {
					this.updateState(this.session, added, removed, childurl);
					continue;
				}
				
				if(typeof added === 'object') {
					var model = this.get(childurl);
					if(!model) {
						model = new BtappModel({'id':childurl});
						model.url = childurl;
						model.client = this.client;
						model.updateState(this.session, added, removed, childurl);
						this.add(model);
					} else {
						model.updateState(this.session, added, removed, childurl);
					}
				}
			}
			var delta = ((new Date()).getTime() - time);
			console.log('updateState(' + this.url + ') - ' + delta);
		}
	});
	
	// BtappModel
	// -------------

	// BtappModel is the base model for most things in the client
	// a torrent is a BtappModel, a file is a BtappModel, properties that 
	// hang off of most BtappModels is also a BtappModel...both BtappModel
	// and BtappCollection objects are responsible for taking the json object
	// that is returned by the client and turning that into attributes/functions/etc
	
	// BtappModel and BtappCollection both support clearState and updateState
	window.BtappModel = Backbone.Model.extend({
		initialize: function(attributes) {
			Backbone.Model.prototype.initialize.apply(this, arguments);
			//assert(this.id); // this is triggering too often (erroneously?)
			_.bindAll(this, 'clearState', 'destructor', 'updateState', 'triggerCustomEvents');
			this.initializeValues();
			
			this.bind('change', this.triggerCustomEvents);
		},
		destructor: function() {
			this.unbind('change', this.triggerCustomEvents);
			this.trigger('destroy');
		},
		// Because there is so much turbulance in the properties of models (they can come and go
		// as clients are disconnected, torrents/peers added/removed, it made sense to be able to
		// bind to add/remove events on a model for when its attributes change
		triggerCustomEvents: function() {
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
					this.trigger('remove:' + p, prev[p]);
					this.trigger('remove', prev[p]);
				}
			}
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
			this.destructor();
			this.clear();
			this.initializeValues();
		},
		updateState: function(session, add, remove, url) {
			var time = (new Date()).getTime();	
			var changed = false;
			this.session = session;
			if(!this.url) {
				this.url = url;
				changed = true;
			}

			add = add || {};
			remove = remove || {};

			// We're going to iterate over both the added and removed diff trees
			// because elements that change exist in both trees, we won't delete
			// elements that exist in remove if they also exist in add...
			// As a nice verification step, we're also going to verify that the remove
			// diff tree contains the old value when we change it to the value in the add
			// diff tree. This should help ensure that we're completely up to date
			// and haven't missed any state dumps
			for(var uv in remove) {
				var added = add[uv];
				var removed = remove[uv];
				var v = escape(uv);
				var childurl = url + v + '/';
				
				if(!added) {
					//special case all
					if(v == 'all') {
						this.updateState(this.session, added, removed, childurl);
						continue;
					}
					
					if(typeof removed === 'object') {
						//Update state downstream from here. Then remove from the collection.
						var model = this.get(v);
						assert(model);
						assert('updateState' in model);
						model.updateState(session, added, removed, childurl);
						this.unset(v, {silent: true});
						changed = true;
					} else if(typeof removed === 'string' && this.client.isFunctionSignature(removed)) {
						assert(v in this.bt);
						delete this.bt[v];
						changed = true;
					} else if(v != 'id') {
						assert(this.get(v) == unescape(removed));
						this.unset(v, {silent: true});
						changed = true;
					}
				}
			}
			
			for(var uv in add) {
				var added = add[uv];
				var removed = remove[uv];
				var v = escape(uv);

				var param = {};
				var childurl = url + v + '/';
				
				// Special case all. It is a redundant layer that exist for the benefit of the torrent client
				if(v == 'all') {
					this.updateState(this.session, added, removed, childurl);
					continue;
				}

				if(typeof added === 'object') {
					// Don't recreate a variable we already have. Just update it.
					var model = this.get(v);
					if(!model) {
						// This is the only hard coding that we should do in this library...
						// As a convenience, torrents and their file/peer lists are treated as backbone collections
						// the same is true of rss_feeds and filters...its just a more intuitive way of using them
						if(	childurl.match(/btapp\/torrent\/$/) ||
							childurl.match(/btapp\/torrent\/all\/[^\/]+\/file\/$/) ||
							childurl.match(/btapp\/torrent\/all\/[^\/]+\/peer\/$/) ||
							childurl.match(/btapp\/label\/$/) ||
							childurl.match(/btapp\/label\/all\/[^\/]+\/torrent\/$/) ||
							childurl.match(/btapp\/label\/all\/[^\/]+\/torrent\/all\/[^\/]+\/file\/jQuery/) ||
							childurl.match(/btapp\/label\/all\/[^\/]+\/torrent\/all\/[^\/]+\/peer\/jQuery/) ||
							childurl.match(/btapp\/rss_feed\/$/) ||
							childurl.match(/btapp\/rss_feed\/all\/[^\/]+\/item\/$/) ||
							childurl.match(/btapp\/rss_filter\/$/) ) {
							model = new BtappCollection;
						} else {
							model = new BtappModel({'id':childurl});
						}
						model.url = childurl;
						model.client = this.client;
						param[v] = model;
						this.set(param, {server:true, silent:true});
						changed = true;
					}
					model.updateState(this.session, added, removed, childurl);
				} else if(typeof added === 'string' && this.client.isFunctionSignature(added)) {
					assert(!(v in this.bt));
					this.bt[v] = this.client.createFunction(session, url + v, added);
					changed = true;
				} else {
					// Set non function/object variables as model attributes
					if(typeof added === 'string') {
						added = unescape(added);
					}
					param[escape(v)] = added;
					// We need to specify server:true so that our overwritten set function 
					// doesn't try to update the client.
					this.set(param, {server:true, silent:true});
					changed = true;
				}	
			}
			if(changed) {
				this.trigger('change');
			}
			var delta = ((new Date()).getTime() - time);
			console.log('updateState(' + this.url + ') - ' + delta);
		}
	});

	// Btapp
	// -------------

	
	// Btapp is the root of the client objects' tree, and generally the only object that clients should instantiate.
	// This mirrors the original api where document.btapp was the root of everything. generally, this api attempts to be
	// as similar as possible to that one...
	
	//BEFORE: 
	//*btapp.torrent.get('XXX').file.get('XXX').properties.get('name');*
	//AFTER: 
	//*btapp.get('torrent').get('XXX').get('file').get('XXX').get('properties').get('name');*
	
	// The primary difference is that in the original you got the state at that exact moment, where
	// we now simply keep the backbone objects up to date (by quick polling and updating as diffs are returned)
	// so you can query at your leisure.
	
	//EVENTS: there are the following events
		//appDownloadProgress
		//filesDragDrop
		//appStopping
		//appUninstall
		//clientMessage
		//commentNotice
		//filesAction
		//rssStatus
		//torrentStatus
		
	// torrentStatus is used internally to keep our objects up to date, but that and clientMessage are really the only
	// events that are generally used...these trigger events when they are received by the base object, so to listen in
	// on torrentStatus events, simply provide a callback to btapp.bind('torrentStatus', callback_func)
	window.Btapp = BtappModel.extend({
		initialize: function(attributes) {
			BtappModel.prototype.initialize.apply(this, arguments);
			attributes = attributes || {};
			assert(typeof attributes === 'object');

			//initialize variables
			this.poll_frequency = attributes.poll_frequency || 3000;
			this.queries = attributes.queries || ['btapp/'];
			this.url = 'btapp/';
			this.id = 'btapp/';

			//bind stuff
			_.bindAll(this, 'fetch', 'onEvents', 'onFetch', 'onConnectionError');
			//Special case the events because we like to offer the convenience of having bindable
			//backbone events triggered when the client triggers a btapp event
			
			//this.bind('add:events', this.setEvents);
			//this.bind('filter', function(filter) { console.log('FILTER: ' + filter); });
			
			//At this point, if a username password combo is provided we assume that we're trying to
			//access a falcon client. If not, default to the client running on your local machine. 
			// You can also pass in "remote_data" that is returned from a falcon.serialize()
			attributes.btapp = this;
			if(('username' in attributes && 'password' in attributes) || 'remote_data' in attributes) {
				this.client = new FalconTorrentClient(attributes);
			} else {
				this.client = new LocalTorrentClient(attributes);
			}
			//While we don't want app writers having to interact with the client directly,
			//it would be nice to be able to listen in on what's going on...so lets just bubble
			//them up as client:XXX messages
			this.client.bind('all', _.bind(function(eventName) {
				this.trigger('client:' + eventName);
			}, this));
			
			this.client.bind('connected', this.fetch);
		},
		destructor: function() {
			//We don't want to destruct the base object even when we can't connect...
			//Its event bindings are the only way we'll known when we've re-connected
			//WARNING: this might leak a wee bit if you have numerous connections in your app
		},
		stop: function() {
			if (this.next_timeout) {
				clearTimeout( this.next_timeout );
			}
			this.client.btapp = null;
			this.client = null;
		},
		onConnectionError: function() {
			console.log('connection lost...retrying...');
			this.clearState();
			this.client.reset();
		},
		onFetch: function(data) {
			assert('session' in data);
			this.waitForEvents(data.session);
		},
		fetch: function() {
			this.client.query('state', this.queries, null, this.onFetch, this.onConnectionError);
		},
		onEvent: function(session, data) {
			this.trigger('event', data);
			//There are two types of events...state updates and callbacks
			//Handle state updates the same way we handle the initial tree building
			if('add' in data || 'remove' in data) {
				data.add = data.add || {};
				data.remove = data.remove || {};
				this.updateState(session, data.add.btapp, data.remove.btapp, 'btapp/');
			} else if('callback' in data && 'arguments' in data) {
				this.client.btappCallbacks[data.callback](data.arguments);
			} else {
				debugger;
			}
		},
		//When we get a poll response from the client, we sort through them here, as well as track round trip time.
		//We also don't fire off another poll request until we've finished up here, so we don't overload the client if
		//it is generating a large diff tree. We should generally on get one element in data array. Anything more and
		//the client has wasted energy creating seperate diff trees.
		onEvents: function(time, session, data) {
			console.log(((new Date()).getTime() - time) + ' ms - ' + jQuery.toJSON(data).length + ' bytes');
			for(var i = 0; i < data.length; i++) {
				this.onEvent(session, data[i]);
			}
			this.next_timeout = setTimeout(_.bind(this.waitForEvents, this, session), this.poll_frequency);
		},
		waitForEvents: function(session) {
			this.client.query('update', null, session, _.bind(this.onEvents, this, (new Date()).getTime(), session), this.onConnectionError);
		}
	});
}).call(this);
