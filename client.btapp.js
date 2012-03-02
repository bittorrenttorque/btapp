// (c) 2012 Patrick Williams, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

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
		assert(typeof functionValue === 'string', 'expected functionValue to be a string');
		assert(typeof variables === 'object', 'expected variables to be an object');
		var signatures = functionValue.match(/\(.*?\)/g);
		return _.any(signatures, function(signature) {
			var signature = signature.match(/\w+/g) || []; //["string","unknown"]
			return signature.length == variables.length && _.all(signature, function(type,index) {
				switch(type) {
					//Most of these types that the client sends up match the typeof values of the javascript
					//types themselves so we can do a direct comparison
					case 'number':
					case 'string':
					case 'boolean':
						return typeof variables[index] === type;
					//In the case of unknown, we have no choice but to trust the argument as
					//the client hasn't specified what type it should be
					case 'unknown':
						return true;
					case 'array':
						return typeof variables[index] === 'object';
					case 'dispatch':
						return typeof variables[index] === 'object' || typeof variables[index] === 'function';
				}
				//has the client provided a type that we weren't expecting?
				throw 'there is an invalid type in the function signature exposed by the client';
			});
		});
	},
	// Functions are simply urls that we make ajax request to. The cb is called with the
	// result of that ajax request.
	createFunction: function(session, url, signatures) {
		assert(session, 'cannot create a function without a session id');
		var func = _.bind(function(cb) {
			assert(cb, 'return value callback is not optional');
			assert(typeof cb === 'function', 'the first argument must be a function that receives the return value for the call to the client');
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
				throw 'arguments do not match any of the function signatures exposed by the client';
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
			path += encodeURIComponent(JSON.stringify(args));
			path += ')/';
			this.query('function', [path], session, cb, function() {});
			this.trigger('queries', url);
		}, this);
		func.valueOf = function() { return signatures; };
		return func;
	},
	query: function(type, queries, session, cb, err) {
		assert(type == "update" || type == "state" || type == "function", 'the query type must be either "update", "state", or "function"');
		cb = cb || function() {};
		err = err || function() {};
		// Handle either an array of strings or just a single query.
		if(typeof queries === 'string') queries = [queries];

		var args = {};
		args['type'] = type;
		if(queries) args['queries'] = JSON.stringify(queries);
		if(session) args['session'] = session;
		var success_callback = _.bind(function(data) {
			if (data == 'invalid request') {
				setTimeout(_.bind(this.reset, this), 1000);
				throw 'pairing occured with a torrent client that does not support the btapp api';
			} else if(!(typeof data === 'object') || 'error' in data) {
				err();
			} else {
				cb(data);
			}
		}, this);
		this.send_query(args, success_callback, err);
	}
});

// Falcon Torrent Client
// -------------

// Falcon torrent client connections are a bit more involved than a client on the local machine
// We have additional javascript dependencies that are substantial enough that we don't load them
// unless you open a falcon connection. In addition we have some handshaking with the falcon proxy
// that we need to wait for.
window.FalconTorrentClient = TorrentClient.extend({
	initialize: function(attributes) {
		TorrentClient.prototype.initialize.call(this, attributes);
		
		assert(('username' in attributes && 'password' in attributes) || 'remote_data' in attributes,
			'attempting to connect to client through falcon without providing the necessary credentials');

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
		// done this previously...the last dependency we load sets the
		// window.falcon variable, so we can just check for that
		if(falcon) {
			_.defer(_.bind(this.reset, this));
			return;
		}

		// If we choose to use falcon we need this specific global config variable defined
		window.config = {
			srp_root:'https://remote.utorrent.com'
		};

		var jsload = 'https://remote.utorrent.com/static/js/jsloadv2.js?v=0.57';
		jQuery.getScript(jsload, _.bind(function(data, textStatus) {
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
			(new JSLoad(tags, "https://remote.utorrent.com/static/js/")).load(['falcon/falcon.session.js'], _.bind(function() {
				if (this.remote_data) {
					this.session = new falcon.session( { client_data: this.remote_data } );
					this.falcon = this.session.api;
					this.trigger('client:connected');
				} else {
					this.reset();
				}
			}, this));
		}, this));
	},
	connect: function() {
		assert(!this.falcon, 'trying to connect with falcon already set');
		// set up some connection variables
		var opts = {
			success: _.bind(function(session) {
				if (this.login_success) { this.login_success(session); }
				this.falcon = this.session.api;
				this.trigger('client:connected');
			}, this),
			error: _.bind(function(xhr, status, data) {
				if (this.login_error) { this.login_error(xhr, status, data); }
			}, this)
		};
		this.session = new falcon.session;
		this.session.negotiate(this.username, this.password, { success: opts.success, error: opts.error, progress: this.login_progress } );
	},
	// This is the Btapp object's gateway to the actual client requests. These requests look slightly
	// different than those headed to a local client because they are encrypted.
	send_query: function(args, cb, err) {
		assert(this.falcon, 'cannot send a query to the client without falcon properly connected');

		this.falcon.request(
			'POST',
			'/client/gui/',
			{'btapp':'backbone.btapp.js'},
			args,
			function(data) {
				assert('build' in data, 'expected build information in the falcon response');
				assert('result' in data, 'expected result information in the falcon response');
				cb(data.result);
			},
			_.bind(function() {
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
		this.btapp = attributes.btapp;
		this.initialize_manager(attributes);
		this.initialize_pairing(attributes);
	},
	// We have a seperate object that is responsible for managing the browser
	// plugin and using that plugin to ensure that Torque is downloaded and
	// running on the local machine.
	initialize_manager: function(attributes) {
		//if we don't have what we need, fetch it and try again
		if(!window.BtappPluginManager) {
			jQuery.getScript(
				'http://apps.bittorrent.com/torque/btapp/plugin.btapp.js',
				_.bind(this.initialize_manager, this, attributes)
			);
			return;
		}
	
		assert(window.BtappPluginManager, 'expected plugin.btapp.js to be loaded by now');
		this.manager = new BtappPluginManager(attributes);
		this.manager.bind('all', this.trigger, this);
	},
	// We have a seperate object responsible for determining exactly which
	// port the torrent client is bound to.
	initialize_pairing: function(attributes) {
		//if we don't have what we need, fetch it and try again
		if(!window.Pairing) {
			jQuery.getScript(
				'http://apps.bittorrent.com/torque/btapp/pairing.btapp.js',
				_.bind(this.initialize_pairing, this, attributes)
			);
			return;
		}
		
		//if we don't have what we need, fetch it and try again
		if(!jQuery.jStorage) {
			jQuery.getScript(
				'http://apps.bittorrent.com/torque/jStorage/jstorage.min.js',
				_.bind(this.initialize_pairing, this, attributes)
			);
			return;
		}
		
		//all right...ready to roll.
		this.pairing = new Pairing;
		this.pairing.bind('all', this.trigger, this);

		this.pairing.bind('pairing:found', _.bind(function(options) {
			if(options && options.version) {
				
				if(!_.any(attributes.clients, function(client) { 
					assert(client.name
				})) {
					return;
				}
			
				var key = jQuery.jStorage.get('pairing_key');
				if(key) {
					// Let whoever triggered the pairing:found event that they don't need
					// to continue scanning, nor do they need to handle aquiring a pairing key
					options.continue_scan = false;
					options.attempt_authorization = false;
					this.connect_to_authenticated_port(options.port, key);
				} else {
					// We've found the port we want to work with, but we don't have a pairing key.
					// We'll set attemp_authorization to true so that a pairing dialog is presented 
					// to the user
					options.continue_scan = false;
					options.attempt_authorization = true;
				}
			}
		}, this));
		this.pairing.bind('pairing:authorized', _.bind(function(options) {
			// Holy smokes! We found a port, and the client that's listening likes our pairing key.
			// Store the key off so that we don't have to bother the user again.
			jQuery.jStorage.set('pairing_key', options.key);
			this.connect_to_authenticated_port(options.port, options.key);
		}, this));

		this.pairing.bind('pairing:nonefound', _.bind(this.delayed_reset, this) );
		this.reset();
	},
	// Before we actual start making requests against a client, we need to make sure
	// we have a valid pairing key. This might be redundant if we just got one from the
	// client, but its very very necessary if we've stored off a pairing key that's invalid
	// for some reason.
	connect_to_authenticated_port: function(port, key) {
		// Called if the pairing key is good to go. Tell whoever is listening that we're
		// ready to roll.
		var cb = function() {
			this.url = 'http://127.0.0.1:' + port + '/btapp/?pairing=' + key;
			this.trigger('client:connected');
		};
		// Handle the case of an invalid pairing key. Flush it out and start over.
		var err = function() {
			jQuery.jStorage.flush();
			this.reset();
		};
	
		jQuery.ajax({
			url: 'http://127.0.0.1:' + port + '/btapp/?pairing=' + key,
			dataType: 'jsonp',
			context: this,
			success: function(data) {
				if(data === 'invalid request') err.call(this);
				else cb.call(this);
			},
			error: err
		});
	},
	delayed_reset: function() {
		setTimeout( _.bind(function() { this.reset() }, this), 1000 );
	},
	reset: function() {
		// Reset is called upon initialization (or when we load pairing.btapp.js)
		// and whenever the btapp object errors out trying to communicate with the
		// torrent client. In both cases we probably need to scan through the ports
		// again as the torrent client won't necessarily be able to connect to the
		// same port when it is relaunched.
		this.pairing.scan();
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
	}
});	
