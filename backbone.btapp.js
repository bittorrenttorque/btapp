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

//if we choose to use falcon we need a global config variable defined
config = {
	srp_root:'https://remote-staging.utorrent.com',
};

function isFunctionSignature(f) {
	return f.match(/\[native function\](\([^\)]*\))+/);
}

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
		//seeing as we're interfacing with a strongly typed language c/c++ we need to 
		//ensure that our types are at least close enough to coherse into the desired types
		//takes something along the lines of "[native function](string,unknown)(string)"
		validateArguments: function(functionValue, variables) {
			assert(typeof functionValue === 'string' && typeof variables === 'object');
			var signatures = functionValue.match(/\(.*?\)/g);
			return _.any(signatures, function(signature) {
				var signature = signature.match(/\w+/g) || []; //["string","unknown"]
				return _.all(signature, function(type,index) { 
					return (type == 'unknown') || (typeof variables[index] === type);
				});
			});
		},
		//functions are simply urls that we make ajax request to...the cb is called with the
		//result of that ajax request.
		createFunction: function(session, url, signatures) {
			assert(session);
			var func = _.bind(function(cb) {
				assert(arguments.length >= 1); //they at least need to provide the callback
				assert(typeof cb === 'function');
				var path = url + '(';
				var args = [];
				
				//lets do a bit of validation of the arguments that we're passing into the client
				//unfortunately arguments isn't a completely authetic javascript array, so we'll have
				//to "splice" by hand...all this just to validate the correct types! sheesh...
				var native_args = [];
				for(var i = 1; i < arguments.length; i++) native_args.push(arguments[i]);
				//this is as close to a static class function as you can get in javascript i guess
				//we should be able to use verifySignaturesArguments to determine if the client will
				//consider the arguments that we're passing to be valid
				if(!TorrentClient.prototype.validateArguments.call(this, signatures, native_args)) {
					alert(signatures + ' cannot accept ' + $.toJSON(native_args));
					return;
				}
				

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
			func.valueOf = function() { return signatures; };
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
			
			var success_callback = function(data) {
				if(!(typeof data === 'object') || 'error' in data)	err();
				else cb(data);
			};
			this.send_query(args, success_callback, err);
		},
	});

	var falcon_initialized = false;
	window.FalconTorrentClient = TorrentClient.extend({
		initialize: function(attributes) {
			TorrentClient.prototype.initialize.call(this, attributes);

			assert(typeof attributes === 'object' && 'username' in attributes && 'password' in attributes);
			this.username = attributes.username;
			this.password = attributes.password;
			
			if(falcon_initialized) {
				_.defer(_.bind(this.reset, this));
				return;
			}
			
			console.log('initializing falcon client');
			console.log('loading falcon external dependencies');
			var jsload = 'https://remote-staging.utorrent.com/static/js/jsloadv2.js?v=0.57';
			$.getScript(jsload, _.bind(function(data, textStatus) {
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
					'falcon/deps/sjcl.js',
					'falcon/falcon.js',
					'falcon/falcon.encryption.js',
					'falcon/falcon.api.js',
					'falcon/falcon.session.js'
				];
				var tags = create_tags(dependencies);
				(new JSLoad(tags, "https://remote-staging.utorrent.com/static/js/")).load(['falcon/falcon.session.js'], _.bind(function() {
					console.log('falcon dependencies loaded...begin exchanging btapp webui information');
					falcon_initialized = true;
					this.reset();
				}, this));
			}, this));
		},
		connect: function() {
			assert(!this.falcon);
			//set up some connection variables
			var opts = {
				success: _.bind(function() {
					console.log('raptor connected successfully');
					this.falcon = this.session.api;
					this.trigger('ready');
				}, this),
				error: _.bind(this.reset, this),
			};
			this.session = new falcon.session;
			this.session.negotiate(this.username,this.password, { success: opts.success } );
		},		
		send_query: function(args, cb, err) {
			//the falcon isn't always available so its important that we get the timing down on using it
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
	
	window.LocalTorrentClient = TorrentClient.extend({
		initialize: function(attributes) {
			TorrentClient.prototype.initialize.call(this, attributes);
			this.url = 'http://localhost:10000/btapp/';
			this.reset();
		},
		send_query: function(args, cb, err) {
			$.ajax({
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
			_.defer(_.bind(this.trigger, this, 'ready'));
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
		updateState: function(session, add, remove, url) {
			this.session = session;
			if(!this.url) this.url = url;
			
			add = add || {};
			remove = remove || {};
			for(var v in remove) {
				var added = add[v];
				var removed = remove[v];
				
				//hey, it was actually removed!
				if(!added) {
					if(v == 'all') {
						this.updateState(this.session, added, removed, url + escape(v) + '/');
						continue;
					}

					//it only should have showed up in this collection if it was an object
					assert(typeof removed === 'object');
					//update state downstream from here...then remove from the collection
					var model = this.get(v);
					assert(model);
					model.updateState(session, added, removed, url + escape(v) + '/');
					this.remove(model);
				}
			}
			for(var v in add) {
				var added = add[v];
				var removed = remove[v];

				//special case all
				if(v == 'all') {
					this.updateState(this.session, added, removed, url + escape(v) + '/');
					continue;
				}
				
				if(typeof added === 'object') {
					//don't recreate a variable we already have...just update it
					var model = this.get(v);
					if(!model) {
						model = new BtappModel({'id':v});
						model.client = this.client;
						model.updateState(this.session, added, removed, url + escape(v) + '/');
						this.add(model);
					} else {
						model.updateState(this.session, added, removed, url + escape(v) + '/');
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
						this.trigger('remove:' + p, prev[p]);
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
		updateState: function(session, add, remove, url) {
			this.session = session;
			if(!this.url) this.url = url;

			add = add || {};
			remove = remove || {};

			//we're going to iterate over both the added and removed diff trees
			//because elements that change exist in both trees, we won't delete
			//elements that exist in remove if they also exist in add...
			//as a nice verification step, we're also going to verify that the remove
			//diff tree contains the old value when we change it to the value in the add
			//diff tree...this should help ensure that we're completely up to date
			//and haven't missed any state dumps
			for(var v in remove) {
				var added = add[v];
				var removed = remove[v];
			
				//this must truely be a remove...lets figure out how to get rid of it
				if(!added) {
					//special case all
					if(v == 'all') {
						this.updateState(this.session, added, removed, url + escape(v) + '/');
						continue;
					}
					
					if(typeof removed === 'object') {
						//update state downstream from here...then remove from the collection
						var model = this.get(v);
						assert(model);
						assert('updateState' in model);
						model.updateState(session, added, removed, url + escape(v) + '/');
						this.unset(v);
					} else if(typeof removed === 'string' && isFunctionSignature(removed)) {
						assert(v in this.bt);
						delete this.bt[v];
						this.trigger('change');
					} else {
						assert(this.get(v) == unescape(removed));
						this.unset(v);
					}
				}
			}
			
			for(var v in add) {
				var added = add[v];
				var removed = remove[v];
				var param = {};
				
				//special case all
				if(v == 'all') {
					this.updateState(this.session, added, removed, url + escape(v) + '/');
					continue;
				}

				if(typeof added === 'object') {
					//don't recreate a variable we already have...just update it
					var model = this.get(v);
					if(!model) {
						//this is the only hard coding that we should do in this library...
						//as a convenience, torrents and their file/peer lists are treated as backbone collections
						//the same is true of rss_feeds and filters...its just a more intuitive way of using them
						var childurl = url + escape(v) + '/';
						if(	childurl.match(/btapp\/torrent\/$/) ||
							childurl.match(/btapp\/torrent\/all\/[^\/]+\/file\/$/) ||
							childurl.match(/btapp\/torrent\/all\/[^\/]+\/peer\/$/) ||
							childurl.match(/btapp\/rss_feed\/$/) ||
							childurl.match(/btapp\/rss_filter\/$/) ) {
							model = new BtappCollection;
						} else {
							model = new BtappModel;
						}
						model.client = this.client;
					}
					model.updateState(this.session, added, removed, url + escape(v) + '/');
					param[v] = model;
					this.set(param,{server:true});
				} else if(typeof added === 'string' && isFunctionSignature(added)) {
					if(!(v in this.bt)) {
						this.bt[v] = this.client.createFunction(session, url + escape(v), added);
						
						this.trigger('change');
					}
				} else {
					//set as attributes
					if(typeof added === 'string') {
						added = unescape(added);
					}
					param[v] = added;
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
			attributes = attributes || {};
			assert(typeof attributes === 'object');
			//call the base model initializer
			BtappModel.prototype.initialize.call(this);
			//initialize variables
			this.poll_frequency = attributes.poll_frequency || 1000;

			//bind stuff
			_.bindAll(this, 'fetch', 'onEvents', 'onFetch', 'onConnectionError');
			this.bind('add:events', this.setEvents);
			//in the future, the creator of Btapp should be able to specify the filters they want
			//we can provide some defaults for people that just want torrents/files/rss/etc
			this.queries = ['btapp/'];
			if('username' in attributes && 'password' in attributes) {
				this.client = new FalconTorrentClient(attributes);
			} else {
				this.client = new LocalTorrentClient(attributes);
			}
			this.client.bind('all', _.bind(function(eventName) {
				this.trigger('client:' + eventName);
			}, this));
			
			this.client.bind('ready', this.fetch);
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
			//there are two types of events...state updates and callbacks
			//handle state updates the same way we handle the initial tree building
			if('add' in data || 'remove' in data) {
				data.add = data.add || {};
				data.remove = data.remove || {};
				this.updateState(session, data.add.btapp, data.remove.btapp, 'btapp/');
				console.log($.toJSON(data.add).length + '/' + $.toJSON(data.remove).length + ' bytes added/removed');
			} else if('callback' in data && 'arguments' in data) {
				this.client.btappCallbacks[data.callback](data.arguments);
			} else {
				debugger;
			}
		},
		onEvents: function(time, session, data) {
			console.log(((new Date()).getTime() - time) + ' ms - ' + JSON.stringify(data).length + ' bytes');
			for(var i = 0; i < data.length; i++) {
				this.onEvent(session, data[i]);
			}
			setTimeout(_.bind(this.waitForEvents, this, session), this.poll_frequency);
		},
		waitForEvents: function(session) {
			this.client.query('update', null, session, _.bind(this.onEvents, this, (new Date()).getTime(), session), this.onConnectionError);
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
