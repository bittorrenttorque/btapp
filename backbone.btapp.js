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
			return f.match(/\[native function\](\([^\)]*\))+/);
		},
		// Seeing as we're interfacing with a strongly typed language c/c++ we need to 
		// ensure that our types are at least close enough to coherse into the desired types
		// takes something along the lines of "[native function](string,unknown)(string)".
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
					alert(signatures + ' cannot accept ' + $.toJSON(native_args));
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
			cb = cb || function() {};
			err = err || function() {};
			// Handle either an array of strings or just a single query.
			if(typeof queries === 'string') queries = [queries];
			
			var args = {};
			args['type'] = type;
			if(queries) args['queries'] = $.toJSON(queries);
			if(session) args['session'] = session;
			
			var success_callback = function(data) {
				if(!(typeof data === 'object') || 'error' in data)	err();
				else cb(data);
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

			assert(typeof attributes === 'object' && 'username' in attributes && 'password' in attributes);
			this.username = attributes.username;
			this.password = attributes.password;
			
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
			// set up some connection variables
			var opts = {
				success: _.bind(function() {
					console.log('raptor connected successfully');
					this.falcon = this.session.api;
					this.trigger('connected');
				}, this),
				error: _.bind(this.reset, this)
			};
			this.session = new falcon.session;
			this.session.negotiate(this.username,this.password, { success: opts.success } );
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
			_.defer(_.bind(this.trigger, this, 'connected'));
		}		
	});	
	
	window.DebugTorrentClient = TorrentClient.extend({
		initialize: function(attributes) {
			TorrentClient.prototype.initialize.call(this, attributes);
			this.update = eval('[{"add":{"btapp":{"add":{"app":"[native function](string)","rss_feed":"[native function](string)","rss_filter":"[native function](string)","torrent":"[native function](string)(string,string)"},"browseforfiles":"[native function](function)","browseforfolder":"[native function](function)","clear_incoming_messages":"[native function]()","clear_private_data":"[native function]()","create":"[native function](function,function,string)(string,function,function,string)(string,string,function,function,string)","dht":{"get_any_hash":"[native function](function)","get_any_peer":"[native function](function)","lookup_file_name":"[native function](string,function)","lookup_partial_hash":"[native function](string,function)","set_id":"[native function](string)"},"dump_memory":"[native function]()","events":{"all":{"appDownloadProgress":"Empty","appStopping":"Empty","appUninstall":"Empty","clientMessage":"Empty","commentNotice":"Empty","filesAction":"Empty","filesDragDrop":"Empty","rssStatus":"Empty","torrentStatus":"Empty"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"fb_apprequest":"[native function](function,string,string,string)(function,string,string,string,string)","fb_login":"[native function](function,string,string)(function,string,string,string)","label":{"all":{"Hidden":{"name":"Hidden","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":{"all":{"0000000000000000000000000000000000051451":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"0000000000000000000000000000000000051451","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"all":{"2D5554333030302D3E63C3AE38C51FDA8C7A0A4C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D53647631CE7529AA1582BEBA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D536482FD6599397ED7A7471B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D5364B75F301AC1693A999FCA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69673BB7CBC953651163A8AC":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69675BF31437D4D3746E689B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69677B4A9BA321445E0AFC9D":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D696799264EE683658EC81311":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D74630CF1C2CB2A9849445951":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463134302AF675AB99567D2":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463319A7E186323FBCBF246":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463E0686BEA7EDA6CE5C288":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C6434654D378A5D353A9827":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C64678D1B3DFE674475C7B8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C64AA2650026AFE266CFF2B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DA163222A7C3AA78EFD9E891E":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640214663D9A54CFB88D77":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640C75F85988C30188CC4C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640E285469FE29FEE900E9":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE6429DEC16D29C36E2DC851":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64458DBA65998E05471BA1":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE644CF597C54CF9E6EA169F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE6466B4151D28D2B33A831B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64885B03CA43E784569051":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64B80E3BA6191D76E78043":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64E1843529F47DC39D86E2":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64EB069D1183C010B5096F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64EB5BE7AAD54135E9C255":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DE06497D79A1F56A0A218539D":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DE064DB9FDC1107026852DD80":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302D1A6867B43B37C9CA196FD1AD":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302D2F68EEA0E0EF34DD8F66AF42":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302DF867FFF20675DDC4DBED20DA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333131422D326890FC9811600C2358D550":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333131422D3268A3ADC0C88ADCA563AF63":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1327034275,"availability":0,"completed_on":0,"created_on":0,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads","distributed_copies":0,"download_speed":107,"downloaded":0,"eta":0,"hash":"0000000000000000000000000000000000051451","is_streamable":"false","label":"uChat","last_active":0,"max_peer_connections":37,"name":"CHAT_COM_CHANNEL","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":0,"queue_order":1,"ratio":0,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":35,"seeds_in_swarm":0,"size":0,"status":201,"superseed":"false","tags":{"0":"uChat","1":"Hidden"},"trackers":{"0":"udp%3a//127.0.0.1%3a22907/announce","2":"udp%3a//tracker.openbittorrent.com%3a80/announce","4":"udp%3a//tracker.publicbt.com%3a80/announce"},"upload_limit":0,"upload_speed":20,"uploaded":0,"uri":"magnet%3a%3fxt%3durn%3abtih%3a0000000000000000000000000000000000051451%26tr%3dudp%253a//127.0.0.1%253a22907/announce%26tr%3dudp%253a//tracker.openbittorrent.com%253a80/announce%26tr%3dudp%253a//tracker.publicbt.com%253a80/announce%26dn%3dCHAT_COM_CHANNEL"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"},"1016430000000000000000000000000000000000":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"1016430000000000000000000000000000000000","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"all":{"2D5554333030302D536477B8964FA0F871EBF87E":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D5364B75F301AC1693A999FCA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D5364F978EF9FC4946EEAF9FC":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696709FE5F43F53C9F66B533":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696723FA87858577F5F0915C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D69673D582D17B3BF2C1044F4":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696766254D4947C16E02F68A":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D69679AB6E14733AD0D568428":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D6967F0B24919CB889FF6DFE9":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D6E63FCDA76DFAE2230216DEF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D74631A4015F8C0CECD6F668F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D74632788577F5A237191A9C8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D7463DE7AFF0F841347C9C257":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D7463E0686BEA7EDA6CE5C288":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D9C64199C49C087B5561075A7":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D9C647B6FF89A4D2611B0ACC1":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE6406FD5248C146753D45AF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE6407463D960606AE175FAA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE643F3DFF942E6E4BD7A3AD":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE646E15874CC98C87AA8956":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE64FDCEDA29752188EBE7F8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE0646829FC1509DAC32488C5":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE064688629A6690549309B8C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE263DDFA5E23ED46E7DC34A5":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333031302DC067FE66D487AD59B3E2D587":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F68084592E242A548CADDAF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F682E565B600616CDA6DE22":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F687AD7D97DEBE5F5875DE6":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F68E13408118B5B69CE2770":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D7F67177392A135F0CF8623FA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1327034275,"availability":0,"completed_on":0,"created_on":0,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads","distributed_copies":0,"download_speed":68,"downloaded":0,"eta":0,"hash":"1016430000000000000000000000000000000000","is_streamable":"false","label":"uChat","last_active":0,"max_peer_connections":37,"name":"Welcome%20to%20uChat","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":0,"queue_order":2,"ratio":0,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":30,"seeds_in_swarm":0,"size":0,"status":201,"superseed":"false","tags":{"0":"uChat","1":"Hidden"},"trackers":{"0":"udp%3a//127.0.0.1%3a22907/announce","2":"udp%3a//tracker.openbittorrent.com%3a80/announce","4":"udp%3a//tracker.publicbt.com%3a80/announce"},"upload_limit":0,"upload_speed":28,"uploaded":0,"uri":"magnet%3a%3fxt%3durn%3abtih%3a1016430000000000000000000000000000000000%26tr%3dudp%253a//127.0.0.1%253a22907/announce%26tr%3dudp%253a//tracker.openbittorrent.com%253a80/announce%26tr%3dudp%253a//tracker.publicbt.com%253a80/announce%26dn%3dWelcome%20to%20uChat"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"}},"The Tunnel":{"name":"The%20Tunnel","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":{"all":{"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"all":{"Sample\\The.Tunnel.2011.720p.x264.Sample-VODO.mkv":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"Sample%5cThe.Tunnel.2011.720p.x264.Sample-VODO.mkv","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":38743775,"infection":"NULL","is_streamable":"true","name":"Sample%5cThe.Tunnel.2011.720p.x264.Sample-VODO.mkv","priority":8,"scanstate":4,"size":38743775,"streaming_url":"http%3a//127.0.0.1%3a22907/proxy%3fsid%3d1825b7f%26file%3d0"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC"},"Support.The.Tunnel.at.VODO.URL":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"Support.The.Tunnel.at.VODO.URL","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":51,"infection":"NULL","is_streamable":"false","name":"Support.The.Tunnel.at.VODO.URL","priority":8,"scanstate":4,"size":51},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC"},"The.Tunnel.2011.720p.x264-VODO.mkv":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"The.Tunnel.2011.720p.x264-VODO.mkv","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":3129715185,"infection":"NULL","is_streamable":"true","name":"The.Tunnel.2011.720p.x264-VODO.mkv","priority":8,"scanstate":4,"size":3129715185,"streaming_url":"http%3a//127.0.0.1%3a22907/proxy%3fsid%3d1825b7f%26file%3d2"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC"},"vodo.nfo":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"vodo.nfo","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":5767,"infection":"NULL","is_streamable":"false","name":"vodo.nfo","priority":8,"scanstate":4,"size":5767},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1326848929,"availability":65536,"completed_on":1326850205,"created_on":1305572680,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads%5cThe.Tunnel.2011.720p.x264-VODO","distributed_copies":1000,"download_speed":0,"download_url":"http%3a//vodo.net/assets/torrents/The.Tunnel.2011.720p.x264-VODO.torrent","downloaded":3168464778,"eta":0,"hash":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC","is_streamable":"true","label":"The%20Tunnel","last_active":142238,"max_peer_connections":37,"name":"The.Tunnel.2011.720p.x264-VODO","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":1000,"queue_order":-1,"ratio":42,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":0,"seeds_in_swarm":0,"size":3168464778,"status":136,"superseed":"false","tags":{"0":"The%20Tunnel"},"trackers":{"0":"http%3a//tracker.vodo.net%3a6970/announce"},"upload_limit":0,"upload_speed":0,"uploaded":133365760,"uri":"magnet%3a%3fxt%3durn%3abtih%3a0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC%26dn%3dThe.Tunnel.2011.720p.x264-VODO%26tr%3dhttp%253a//tracker.vodo.net%253a6970/announce"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"}},"uChat":{"name":"uChat","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":{"all":{"0000000000000000000000000000000000051451":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"0000000000000000000000000000000000051451","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"all":{"2D5554333030302D3E63C3AE38C51FDA8C7A0A4C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D53647631CE7529AA1582BEBA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D536482FD6599397ED7A7471B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D5364B75F301AC1693A999FCA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69673BB7CBC953651163A8AC":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69675BF31437D4D3746E689B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69677B4A9BA321445E0AFC9D":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D696799264EE683658EC81311":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D74630CF1C2CB2A9849445951":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463134302AF675AB99567D2":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463319A7E186323FBCBF246":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463E0686BEA7EDA6CE5C288":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C6434654D378A5D353A9827":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C64678D1B3DFE674475C7B8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C64AA2650026AFE266CFF2B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DA163222A7C3AA78EFD9E891E":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640214663D9A54CFB88D77":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640C75F85988C30188CC4C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640E285469FE29FEE900E9":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE6429DEC16D29C36E2DC851":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64458DBA65998E05471BA1":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE644CF597C54CF9E6EA169F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE6466B4151D28D2B33A831B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64885B03CA43E784569051":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64B80E3BA6191D76E78043":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64E1843529F47DC39D86E2":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64EB069D1183C010B5096F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64EB5BE7AAD54135E9C255":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DE06497D79A1F56A0A218539D":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DE064DB9FDC1107026852DD80":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302D1A6867B43B37C9CA196FD1AD":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302D2F68EEA0E0EF34DD8F66AF42":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302DF867FFF20675DDC4DBED20DA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333131422D326890FC9811600C2358D550":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333131422D3268A3ADC0C88ADCA563AF63":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1327034275,"availability":0,"completed_on":0,"created_on":0,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads","distributed_copies":0,"download_speed":107,"downloaded":0,"eta":0,"hash":"0000000000000000000000000000000000051451","is_streamable":"false","label":"uChat","last_active":0,"max_peer_connections":37,"name":"CHAT_COM_CHANNEL","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":0,"queue_order":1,"ratio":0,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":35,"seeds_in_swarm":0,"size":0,"status":201,"superseed":"false","tags":{"0":"uChat","1":"Hidden"},"trackers":{"0":"udp%3a//127.0.0.1%3a22907/announce","2":"udp%3a//tracker.openbittorrent.com%3a80/announce","4":"udp%3a//tracker.publicbt.com%3a80/announce"},"upload_limit":0,"upload_speed":20,"uploaded":0,"uri":"magnet%3a%3fxt%3durn%3abtih%3a0000000000000000000000000000000000051451%26tr%3dudp%253a//127.0.0.1%253a22907/announce%26tr%3dudp%253a//tracker.openbittorrent.com%253a80/announce%26tr%3dudp%253a//tracker.publicbt.com%253a80/announce%26dn%3dCHAT_COM_CHANNEL"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"},"1016430000000000000000000000000000000000":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"1016430000000000000000000000000000000000","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"all":{"2D5554333030302D536477B8964FA0F871EBF87E":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D5364B75F301AC1693A999FCA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D5364F978EF9FC4946EEAF9FC":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696709FE5F43F53C9F66B533":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696723FA87858577F5F0915C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D69673D582D17B3BF2C1044F4":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696766254D4947C16E02F68A":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D69679AB6E14733AD0D568428":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D6967F0B24919CB889FF6DFE9":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D6E63FCDA76DFAE2230216DEF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D74631A4015F8C0CECD6F668F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D74632788577F5A237191A9C8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D7463DE7AFF0F841347C9C257":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D7463E0686BEA7EDA6CE5C288":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D9C64199C49C087B5561075A7":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D9C647B6FF89A4D2611B0ACC1":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE6406FD5248C146753D45AF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE6407463D960606AE175FAA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE643F3DFF942E6E4BD7A3AD":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE646E15874CC98C87AA8956":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE64FDCEDA29752188EBE7F8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE0646829FC1509DAC32488C5":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE064688629A6690549309B8C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE263DDFA5E23ED46E7DC34A5":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333031302DC067FE66D487AD59B3E2D587":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F68084592E242A548CADDAF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F682E565B600616CDA6DE22":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F687AD7D97DEBE5F5875DE6":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F68E13408118B5B69CE2770":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D7F67177392A135F0CF8623FA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1327034275,"availability":0,"completed_on":0,"created_on":0,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads","distributed_copies":0,"download_speed":68,"downloaded":0,"eta":0,"hash":"1016430000000000000000000000000000000000","is_streamable":"false","label":"uChat","last_active":0,"max_peer_connections":37,"name":"Welcome%20to%20uChat","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":0,"queue_order":2,"ratio":0,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":30,"seeds_in_swarm":0,"size":0,"status":201,"superseed":"false","tags":{"0":"uChat","1":"Hidden"},"trackers":{"0":"udp%3a//127.0.0.1%3a22907/announce","2":"udp%3a//tracker.openbittorrent.com%3a80/announce","4":"udp%3a//tracker.publicbt.com%3a80/announce"},"upload_limit":0,"upload_speed":28,"uploaded":0,"uri":"magnet%3a%3fxt%3durn%3abtih%3a1016430000000000000000000000000000000000%26tr%3dudp%253a//127.0.0.1%253a22907/announce%26tr%3dudp%253a//tracker.openbittorrent.com%253a80/announce%26tr%3dudp%253a//tracker.publicbt.com%253a80/announce%26dn%3dWelcome%20to%20uChat"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"}}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"language":{"all":{"name":"default"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"log":"[native function](string)","peer_id":"2D5554333130422DCA643DD16193D38AB4857220","properties":{"all":{"background":"false","badging_num":0,"max_api_version":"NULL","min_api_version":"NULL","mixpanel":"NULL","name":"NULL","permissions":1080783,"updateUrl":"NULL","visible":"false"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"ready_for_events":"[native function]()","reload":"[native function]()","resolve_country":"[native function]()","resource":"[native function](string)(boolean,string)","rsa":{"hash_sha1":"[native function](string)","rsa_generate_key":"[native function]()","rsa_sign_hash":"[native function](string,string)","rsa_verify_signature":"[native function](string,string,string)","verify_rsa_signature_appkey":"[native function](array,array,number)"},"rss_feed":{"all":{"DHTFeed":{"force_update":"[native function]()","item":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"alias":"DHTFeed","download_state":-1,"enabled":"true","next_update":1327386881,"programmed":"true","smart_filter":"false","url":"DHTFeed","use_feed_title":"true","user_selected":"false"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"remove":"[native function]()"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"rss_filter":{"all":{"New Filter":{"id":1,"properties":{"all":{"directory":"NULL","episode_filter":"false","feed":-1,"flags":1,"last_match":0,"name":"New%20Filter","postpone_mode":0,"quality":-1,"repack_ep_filter":0,"resolving_candidate":"false","smart_ep_filter":"false"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"}}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"sendmsg":"[native function](string,number,number,string)","sendtopeer":"[native function](string,string,string)","settings":{"all":{"activate_on_file":"true","always_show_add_dialog":"false","anoninfo":"true","api_version":"1.2","append_incomplete":"false","ascon":0,"asdl":0,"asdns":0,"assz":0,"av_auto_update":"true","av_enabled":"true","avwindow":199092,"bind_port":22907,"boss_key":0,"boss_key_salt":0,"bt.allow_same_ip":"true","bt.auto_dl_enable":"true","bt.auto_dl_factor":80,"bt.auto_dl_interval":120,"bt.auto_dl_qos_min":8500,"bt.auto_dl_sample_average":5,"bt.auto_dl_sample_window":15,"bt.ban_ratio":128,"bt.ban_threshold":3,"bt.compact_allocation":"false","bt.connect_speed":7,"bt.determine_encoded_rate_for_streamables":"true","bt.dl_queue_factor":4,"bt.dna_enabled":"true","bt.enable_pulse":"true","bt.enable_tracker":"false","bt.extra_ul_max":10,"bt.extra_ul_rand":128,"bt.failover_peer_speed_threshold":512,"bt.few_pieces_thres":4,"bt.graceful_shutdown":"true","bt.http_pending_limit":4,"bt.multiscrape":"true","bt.no_connect_to_services":"true","bt.no_connect_to_services_list":"25%2c80%2c110%2c443%2c6666%2c6667","bt.prio_first_last_piece":"false","bt.prio_piece_thres":20,"bt.prioritize_partial_pieces":"false","bt.pulse_interval":1200,"bt.pulse_weight":200,"bt.ratelimit_tcp_only":"false","bt.save_resume_rate":120,"bt.scrape_stopped":"false","bt.send_have_to_seed":"true","bt.sequential_download":"false","bt.sequential_files":"false","bt.set_sockbuf":"false","bt.shutdown_tracker_timeout":15,"bt.shutdown_upnp_timeout":5,"bt.tcp_rate_control":"true","bt.transp_disposition":21,"bt.ul_queue_factor":2,"bt.use_ban_ratio":"true","bt.use_rangeblock":"true","btapps.app_store":"http%3a//apps.bittorrent.com/discoverContent/discoverContent.btapp","btapps.apps_channel":"http%3a//pr.apps.bittorrent.com/share/share.btapp","btapps.auto_update_btapps":"true","btapps.auto_update_btinstalls":"false","btapps.enable_activex":"true","btapps.install_unsigned_apps":"true","cache.disable_win_read":"true","cache.disable_win_write":"true","cache.override":"false","cache.override_size":32,"cache.read":"true","cache.read_prune":"true","cache.read_thrash":"false","cache.read_turnoff":"true","cache.reduce":"true","cache.write":"true","cache.writeimm":"true","cache.writeout":"true","check_assoc_on_start":"true","check_update":"true","check_update_beta":"false","choker.interval":10,"choker.interval_auto":"true","choker.interval_optim":30,"clientname":"uTorrent","close_to_tray":"true","computer_id":"8ecdujZoHxI7fuzr","confirm_exit":"true","confirm_exit_critical_seeder":"true","confirm_remove_tracker":"true","confirm_when_deleting":"true","conns_globally":200,"conns_per_torrent":50,"dht":"true","dht.collect_feed":"false","dht.rate":-1,"dht_per_torrent":"true","dir_active_download_flag":"false","dir_add_label":"false","dir_autoload_delete":"false","dir_autoload_flag":"false","dir_completed_download_flag":"false","dir_completed_torrents_flag":"false","dir_torrent_files_flag":"false","disable_fw":"true","diskio.cache_reduce_minutes":9,"diskio.cache_stripe":128,"diskio.coalesce_write_size":2097152,"diskio.coalesce_writes":"true","diskio.flush_files":"true","diskio.max_write_queue":32,"diskio.no_zero":"true","diskio.resume_min":100,"diskio.rsize_factor":16,"diskio.smart_hash":"true","diskio.smart_sparse_hash":"true","diskio.sparse_files":"false","diskio.use_partfile":"true","dna.server_prefix":"generator.dna.bittorrent.com/url%3furl%3d%25s","dna_disable_screensaver":"true","dna_download_total":0,"dna_enable":1,"dna_notify":0,"dna_only":0,"dna_show_systray_icon":"true","dna_upload_limit":0,"dna_upload_total":0,"dw":0,"enable_scrape":"true","encryption_allow_legacy":"true","encryption_mode":0,"externalip":"0.0.0.0%3a0","fd":181,"gui.alternate_color":"false","gui.auto_restart":"true","gui.bypass_search_redirect":"false","gui.category_list_spaces":"true","gui.color_progress_bars":"true","gui.combine_listview_status_done":"true","gui.compat_diropen":"false","gui.default_del_action":0,"gui.delete_to_trash":"true","gui.dlrate_menu":"0%2c5%2c10%2c15%2c20%2c30%2c40%2c50%2c100%2c150%2c200%2c300%2c400%2c500","gui.enable_comments":"true","gui.enable_ratings":"true","gui.find_pane":"true","gui.granular_priority":"false","gui.graph_legend":"true","gui.graph_overhead":"true","gui.graph_tcp_rate_control":"false","gui.graphic_progress":"true","gui.limits_in_statusbar":"false","gui.log_date":"true","gui.manual_ratemenu":"false","gui.overhead_in_statusbar":"false","gui.piecebar_progress":"false","gui.report_problems":"true","gui.show_av_icon":"false","gui.show_devices":"true","gui.show_notorrents_node":"false","gui.show_player_node":"false","gui.show_plus_upsell":"true","gui.show_rss_favicons":"true","gui.show_status_icon_in_dl_list":"false","gui.speed_in_title":"false","gui.tall_category_list":"true","gui.toolbar_labels":"false","gui.transparent_graph_legend":"false","gui.ulrate_menu":"0%2c5%2c10%2c15%2c20%2c30%2c40%2c50%2c100%2c150%2c200%2c300%2c400%2c500","gui.update_rate":500,"gui.use_fuzzy_dates":"true","gui.wide_toolbar":"false","initial_install_version":0,"install_modification_time":0,"install_revision":25802,"ipfilter.enable":"true","is_plus_active":"true","isp.bep22":"true","isp.peer_policy_enable":"true","isp.peer_policy_expy":1327389576,"isp.peer_policy_override":"false","isp.primary_dns":"208.67.222.222","isp.secondary_dns":"208.67.220.220","language":-1,"limit_dna_upload":"false","logger.log_upnp_to_file":"false","logger_mask_debug":134217728,"lsd":"true","mainwnd_split":360,"mainwnd_split_x":172,"mainwndstatus":4,"max_active_downloads":5,"max_active_torrent":8,"max_dl_rate":0,"max_ul_rate":0,"max_ul_rate_seed":0,"max_ul_rate_seed_flag":"false","minified":"false","minimize_to_tray":"false","move_if_defdir":"true","multi_day_transfer_limit_en":"false","multi_day_transfer_limit_span":11,"multi_day_transfer_limit_unit":1,"multi_day_transfer_limit_value":200,"multi_day_transfer_mode_dl":"false","multi_day_transfer_mode_ul":"false","multi_day_transfer_mode_uldl":"true","natpmp":"true","net.calc_overhead":"false","net.calc_rss_overhead":"true","net.calc_tracker_overhead":"true","net.diffserv_codepoint":-1,"net.disable_incoming_ipv6":"false","net.discoverable":"true","net.limit_excludeslocal":"false","net.low_cpu":"false","net.max_halfopen":100,"net.outgoing_max_port":0,"net.outgoing_port":0,"net.ratelimit_utp":"true","net.upnp_tcp_only":"false","net.utp_dynamic_packet_size":"true","net.utp_initial_packet_size":4,"net.utp_packet_size_interval":10,"net.utp_receive_target_delay":100,"net.utp_target_delay":100,"no_local_dns":"false","notify_complete":"true","only_proxied_conns":"false","peer.disconnect_inactive":"true","peer.disconnect_inactive_interval":300,"peer.lazy_bitfield":"true","peer.lazy_bitfield_factor":24,"peer.lazy_bitfield_mode":0,"peer.lazy_bitfield_nohave":0,"peer.resolve_country":"false","pex":"true","plus_expiry":1354924463,"plus_license":"5e2a52db35170f98","prealloc_space":"false","private_ip":"false","proxy.auth":"false","proxy.p2p":"false","proxy.port":8080,"proxy.resolve":"false","proxy.type":0,"queue.dont_count_slow_dl":"true","queue.dont_count_slow_ul":"true","queue.prio_no_seeds":"true","queue.slow_dl_threshold":1000,"queue.slow_ul_threshold":1000,"queue.started_bonus":0,"queue.switchtime":60,"queue.switchtime_prio":300,"queue.use_seed_peer_ratio":"true","rand_port_on_start":"false","rate_limit_local_peers":"false","remove_torrent_files_with_private_data":"true","resolve_peerips":"true","resume.dir_only":"false","resume.enable_resume_dir":"false","revision":"25802","rss.feed_as_default_label":"true","rss.smart_repack_filter":"true","rss.update_interval":15,"s_url":"https%3a//www.surveymonkey.com/s/JYWZ3YH","sched_dis_dht":"true","sched_dl_rate":0,"sched_enable":"false","sched_interaction":"false","sched_table":"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","sched_ul_rate":0,"sdur":345600,"search_list":"BitTorrent%7chttp%3a//www.bittorrent.com/search%3fclient%3d%25v%26search%3d%0d%0aMininova%7chttp%3a//www.mininova.org/search/%3fcat%3d0%26search%3d","search_list_sel":0,"seed_num":0,"seed_prio_limitul":4,"seed_prio_limitul_flag":"false","seed_ratio":1500,"seed_time":0,"seeds_prioritized":"false","settings_saved_systime":1327385975,"show_add_dialog":"true","show_category":"true","show_details":"true","show_files_tab":"true","show_general_tab":"true","show_logger_tab":"true","show_peers_tab":"true","show_pieces_tab":"false","show_pulse_tab":"true","show_speed_tab":"true","show_status":"true","show_tabicons":"true","show_toolbar":"true","show_tracker_tab":"true","sid1":1,"sid2":5,"sid3":2,"sid4":0,"sid5":0,"silent_auto_updates":"false","smaxage":31536000,"sminage":1209600,"smode":3,"ssamper":1000,"start_minimized":"true","stats.video1.finished":"false","stats.video1.time_watched":0,"stats.video2.finished":"false","stats.video2.time_watched":0,"stats.video3.finished":"false","stats.video3.time_watched":0,"stats.welcome_page_useful":0,"stitle":"Take%20our%20survey","store_torr_infohash":"false","streaming.failover_rate_factor":200,"streaming.failover_set_percentage":70,"streaming.min_buffer_piece":5,"streaming.safety_factor":110,"sys.enable_wine_hacks":"true","sys.prevent_standby":"true","td":8613588376,"torrents_start_stopped":"false","tray.show":"true","tray.single_click":"false","tray_activate":"true","tu":1982429041,"ul_rate_download_thres":0,"ul_slots_per_torrent":4,"upnp":"true","upnp.external_tcp_port":0,"upnp.external_udp_port":0,"use_boss_key_pw":"false","use_udp_trackers":"true","v":102851786,"webui.allow_pairing":"true","webui.cookie":"%7b%7d","webui.enable":0,"webui.enable_guest":0,"webui.enable_listen":0,"webui.guest":"guest","webui.port":8080,"webui.raptor_host":"raptor-staging.utorrent.com","webui.raptor_port":443,"webui.raptor_secure":"true","webui.remote_enable":"true","webui.ssdp_uuid":"9079f183-2e21-e111-b7d5-f0def11cadd2","webui.talon_host":"remote-staging.utorrent.com","webui.talon_port":80,"webui.talon_secure":"false","webui.token_auth":"true","webui.uconnect_actions_count":0,"webui.uconnect_actions_list_count":0,"webui.uconnect_connected_ever":"true","webui.uconnect_enable":"true","webui.uconnect_enable_ever":"true","webui.uconnect_password":"%2a%2a%2a%2a%2a%2a%2a%2a%2a%2a%2a","webui.uconnect_question_opted_out":"false","webui.uconnect_srp_required":"true","webui.uconnect_toolbar_ever":"false","webui.uconnect_username":"username","webui.uconnect_username_anonymous":"00000-anonymous-9399657931--1082797151","webui.update_message":"A%20new%20release%20candidate%20version%20of%20%b5Torrent%203.1%20is%20available.%20Would%20you%20like%20to%20download%20and%20install%20it%3f%0d%0a%3ca%20href%3d%22http%3a//forum.utorrent.com/viewtopic.php%3fid%3d105596%22%3eClick%20here%20to%20view%20the%20complete%20list%20of%20changes%20in%20this%20release.%3c/a%3e%0d%0a%0d%0aPlease%20be%20sure%20to%20verify%20or%20recreate%20your%20firewall%20rules%20after%20upgrading%20to%20ensure%20that%20%b5Torrent%20isn%27t%20being%20blocked.%0d%0a%0d%0aThis%20will%20also%20download%20the%20latest%20translations.","webui.username":"admin"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"showpreferences":"[native function]()","stash":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":{"all":{"0000000000000000000000000000000000051451":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"0000000000000000000000000000000000051451","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"all":{"2D5554333030302D3E63C3AE38C51FDA8C7A0A4C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D53647631CE7529AA1582BEBA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D536482FD6599397ED7A7471B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D5364B75F301AC1693A999FCA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69673BB7CBC953651163A8AC":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69675BF31437D4D3746E689B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D69677B4A9BA321445E0AFC9D":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D696799264EE683658EC81311":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D74630CF1C2CB2A9849445951":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463134302AF675AB99567D2":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463319A7E186323FBCBF246":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D7463E0686BEA7EDA6CE5C288":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C6434654D378A5D353A9827":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C64678D1B3DFE674475C7B8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302D9C64AA2650026AFE266CFF2B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DA163222A7C3AA78EFD9E891E":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640214663D9A54CFB88D77":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640C75F85988C30188CC4C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE640E285469FE29FEE900E9":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE6429DEC16D29C36E2DC851":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64458DBA65998E05471BA1":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE644CF597C54CF9E6EA169F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE6466B4151D28D2B33A831B":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64885B03CA43E784569051":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64B80E3BA6191D76E78043":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64E1843529F47DC39D86E2":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64EB069D1183C010B5096F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DCE64EB5BE7AAD54135E9C255":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DE06497D79A1F56A0A218539D":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333030302DE064DB9FDC1107026852DD80":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302D1A6867B43B37C9CA196FD1AD":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302D2F68EEA0E0EF34DD8F66AF42":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333130302DF867FFF20675DDC4DBED20DA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333131422D326890FC9811600C2358D550":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"},"2D5554333131422D3268A3ADC0C88ADCA563AF63":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"0000000000000000000000000000000000051451"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1327034275,"availability":0,"completed_on":0,"created_on":0,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads","distributed_copies":0,"download_speed":107,"downloaded":0,"eta":0,"hash":"0000000000000000000000000000000000051451","is_streamable":"false","label":"uChat","last_active":0,"max_peer_connections":37,"name":"CHAT_COM_CHANNEL","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":0,"queue_order":1,"ratio":0,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":35,"seeds_in_swarm":0,"size":0,"status":201,"superseed":"false","tags":{"0":"uChat","1":"Hidden"},"trackers":{"0":"udp%3a//127.0.0.1%3a22907/announce","2":"udp%3a//tracker.openbittorrent.com%3a80/announce","4":"udp%3a//tracker.publicbt.com%3a80/announce"},"upload_limit":0,"upload_speed":20,"uploaded":0,"uri":"magnet%3a%3fxt%3durn%3abtih%3a0000000000000000000000000000000000051451%26tr%3dudp%253a//127.0.0.1%253a22907/announce%26tr%3dudp%253a//tracker.openbittorrent.com%253a80/announce%26tr%3dudp%253a//tracker.publicbt.com%253a80/announce%26dn%3dCHAT_COM_CHANNEL"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"},"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"all":{"Sample\\The.Tunnel.2011.720p.x264.Sample-VODO.mkv":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"Sample%5cThe.Tunnel.2011.720p.x264.Sample-VODO.mkv","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":38743775,"infection":"NULL","is_streamable":"true","name":"Sample%5cThe.Tunnel.2011.720p.x264.Sample-VODO.mkv","priority":8,"scanstate":4,"size":38743775,"streaming_url":"http%3a//127.0.0.1%3a22907/proxy%3fsid%3d1825b7f%26file%3d0"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC"},"Support.The.Tunnel.at.VODO.URL":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"Support.The.Tunnel.at.VODO.URL","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":51,"infection":"NULL","is_streamable":"false","name":"Support.The.Tunnel.at.VODO.URL","priority":8,"scanstate":4,"size":51},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC"},"The.Tunnel.2011.720p.x264-VODO.mkv":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"The.Tunnel.2011.720p.x264-VODO.mkv","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":3129715185,"infection":"NULL","is_streamable":"true","name":"The.Tunnel.2011.720p.x264-VODO.mkv","priority":8,"scanstate":4,"size":3129715185,"streaming_url":"http%3a//127.0.0.1%3a22907/proxy%3fsid%3d1825b7f%26file%3d2"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC"},"vodo.nfo":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"vodo.nfo","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":5767,"infection":"NULL","is_streamable":"false","name":"vodo.nfo","priority":8,"scanstate":4,"size":5767},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1326848929,"availability":65536,"completed_on":1326850205,"created_on":1305572680,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads%5cThe.Tunnel.2011.720p.x264-VODO","distributed_copies":1000,"download_speed":0,"download_url":"http%3a//vodo.net/assets/torrents/The.Tunnel.2011.720p.x264-VODO.torrent","downloaded":3168464778,"eta":0,"hash":"0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC","is_streamable":"true","label":"The%20Tunnel","last_active":142238,"max_peer_connections":37,"name":"The.Tunnel.2011.720p.x264-VODO","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":1000,"queue_order":-1,"ratio":42,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":0,"seeds_in_swarm":0,"size":3168464778,"status":136,"superseed":"false","tags":{"0":"The%20Tunnel"},"trackers":{"0":"http%3a//tracker.vodo.net%3a6970/announce"},"upload_limit":0,"upload_speed":0,"uploaded":133365760,"uri":"magnet%3a%3fxt%3durn%3abtih%3a0819CCEE9EBE25D7A02FE14496D58AF10EF94AEC%26dn%3dThe.Tunnel.2011.720p.x264-VODO%26tr%3dhttp%253a//tracker.vodo.net%253a6970/announce"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"},"1016430000000000000000000000000000000000":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"1016430000000000000000000000000000000000","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"all":{"2D5554333030302D536477B8964FA0F871EBF87E":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D5364B75F301AC1693A999FCA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D5364F978EF9FC4946EEAF9FC":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696709FE5F43F53C9F66B533":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696723FA87858577F5F0915C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D69673D582D17B3BF2C1044F4":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D696766254D4947C16E02F68A":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D69679AB6E14733AD0D568428":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D6967F0B24919CB889FF6DFE9":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D6E63FCDA76DFAE2230216DEF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D74631A4015F8C0CECD6F668F":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D74632788577F5A237191A9C8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D7463DE7AFF0F841347C9C257":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D7463E0686BEA7EDA6CE5C288":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D9C64199C49C087B5561075A7":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302D9C647B6FF89A4D2611B0ACC1":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE6406FD5248C146753D45AF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE6407463D960606AE175FAA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE643F3DFF942E6E4BD7A3AD":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE646E15874CC98C87AA8956":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DCE64FDCEDA29752188EBE7F8":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE0646829FC1509DAC32488C5":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE064688629A6690549309B8C":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333030302DE263DDFA5E23ED46E7DC34A5":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333031302DC067FE66D487AD59B3E2D587":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F68084592E242A548CADDAF":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F682E565B600616CDA6DE22":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F687AD7D97DEBE5F5875DE6":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D2F68E13408118B5B69CE2770":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"},"2D5554333130302D7F67177392A135F0CF8623FA":{"flush":"[native function]()","keep_connected":"[native function](number)","properties":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"torrent":"1016430000000000000000000000000000000000"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1327034275,"availability":0,"completed_on":0,"created_on":0,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads","distributed_copies":0,"download_speed":68,"downloaded":0,"eta":0,"hash":"1016430000000000000000000000000000000000","is_streamable":"false","label":"uChat","last_active":0,"max_peer_connections":37,"name":"Welcome%20to%20uChat","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":0,"queue_order":2,"ratio":0,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":30,"seeds_in_swarm":0,"size":0,"status":201,"superseed":"false","tags":{"0":"uChat","1":"Hidden"},"trackers":{"0":"udp%3a//127.0.0.1%3a22907/announce","2":"udp%3a//tracker.openbittorrent.com%3a80/announce","4":"udp%3a//tracker.publicbt.com%3a80/announce"},"upload_limit":0,"upload_speed":28,"uploaded":0,"uri":"magnet%3a%3fxt%3durn%3abtih%3a1016430000000000000000000000000000000000%26tr%3dudp%253a//127.0.0.1%253a22907/announce%26tr%3dudp%253a//tracker.openbittorrent.com%253a80/announce%26tr%3dudp%253a//tracker.publicbt.com%253a80/announce%26dn%3dWelcome%20to%20uChat"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"},"C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A":{"add_comment":"[native function](string,string)","add_peer":"[native function](string)(function)","availability":"[native function]()","discover_local_peers":"[native function]()","file":{"all":{"Captive by Megan Lisa Jones - Bittorrent Edition.pdf":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"Captive%20by%20Megan%20Lisa%20Jones%20-%20Bittorrent%20Edition.pdf","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":3075568,"infection":"NULL","is_streamable":"false","name":"Captive%20by%20Megan%20Lisa%20Jones%20-%20Bittorrent%20Edition.pdf","priority":8,"scanstate":4,"size":3075568},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A"},"Description.txt":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"Description.txt","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":1872,"infection":"NULL","is_streamable":"false","name":"Description.txt","priority":8,"scanstate":4,"size":1872},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A"},"Introduction to Captive by Megan Lisa Jones - BitTorrent Edition.mov":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"Introduction%20to%20Captive%20by%20Megan%20Lisa%20Jones%20-%20BitTorrent%20Edition.mov","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":219561953,"infection":"NULL","is_streamable":"true","name":"Introduction%20to%20Captive%20by%20Megan%20Lisa%20Jones%20-%20BitTorrent%20Edition.mov","priority":8,"scanstate":4,"size":219561953,"streaming_url":"http%3a//127.0.0.1%3a22907/proxy%3fsid%3dcd8ace4%26file%3d2"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A"},"License.txt":{"force_stream":"[native function]()","get_data":"[native function]()","is_streaming":"[native function]()","name":"License.txt","open":"[native function]()","open_containing":"[native function]()","properties":{"all":{"downloaded":142,"infection":"NULL","is_streamable":"false","name":"License.txt","priority":8,"scanstate":4,"size":142},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"stream":"[native function]()","torrent":"C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"force_start":"[native function]()","force_stream":"[native function]()","get_comments":"[native function]()","get_magnet_uri":"[native function]()","hash":"C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A","is_created":"[native function]()","is_streaming":"[native function]()","keep_connected":"[native function](number)","open_containing":"[native function]()","pause":"[native function]()","peer":{"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"properties":{"all":{"added_on":1327039135,"availability":65536,"completed_on":1327042445,"created_on":1301590654,"dht":"true","directory":"C%3a%5cUsers%5cPatrick%5cDownloads%5cMegan%20Lisa%20Jones%20-%20Captive%20%28BitTorrent%20Edition%29","distributed_copies":1000,"download_speed":0,"download_url":"http%3a//www.clearbits.net/get/1684-captive---bittorrent-edition.torrent","downloaded":254473647,"eta":0,"hash":"C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A","is_streamable":"true","last_active":81693,"max_peer_connections":37,"name":"Megan%20Lisa%20Jones%20-%20Captive%20%28BitTorrent%20Edition%29","peers_connected":0,"peers_in_swarm":0,"pex":"true","progress":1000,"queue_order":-1,"ratio":38,"remaining":0,"seed_override":"false","seed_ratio":1500,"seed_time":0,"seeds_connected":0,"seeds_in_swarm":0,"size":222639535,"status":136,"superseed":"false","trackers":{"0":"http%3a//tracker001.clearbits.net%3a7070/announce"},"upload_limit":0,"upload_speed":0,"uploaded":9830400,"uri":"magnet%3a%3fxt%3durn%3abtih%3aC106173C44ACE99F57FCB83561AEFD6EAE8A6F7A%26dn%3dMegan%2520Lisa%2520Jones%2520-%2520Captive%2520%2528BitTorrent%2520Edition%2529%26tr%3dhttp%253a//tracker001.clearbits.net%253a7070/announce"},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"},"recheck":"[native function]()","remove":"[native function](number)()","set_priority":"[native function](number)","start":"[native function]()","stop":"[native function]()","stream":"[native function]()","unpause":"[native function]()"}},"get":"[native function](string)","keys":"[native function]()","set":"[native function](string,unknown)","unset":"[native function](string)"}}},"remove":{"btapp":{}}}]');
			this.reset();
		},
		send_query: function(args, cb, err) {
			switch(args.type) {
				case 'state':
				_.defer(function() { 
					var state = {};
					state.session = '12312312312';
					cb(state); 
				})
				break;
				case 'function':
				_.defer(function() { cb([]); })
				break;
				case 'update':
				_.defer(_.bind(function() {
					cb(this.update);
					var tmp = this.update[0].add;
					this.update[0].add = this.update[0].remove;
					this.update[0].remove = tmp;
				}, this));
				break;			
			}
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
			assert(this.id);
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

			//bind stuff
			_.bindAll(this, 'fetch', 'onEvents', 'onFetch', 'onConnectionError');
			//Special case the events because we like to offer the convenience of having bindable
			//backbone events triggered when the client triggers a btapp event
			
			//this.bind('add:events', this.setEvents);
			//this.bind('filter', function(filter) { console.log('FILTER: ' + filter); });
			
			//At this point, if a username password combo is provided we assume that we're trying to
			//access a falcon client. If not, default to the client running on your local machine
			if('username' in attributes && 'password' in attributes) {
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
			console.log(((new Date()).getTime() - time) + ' ms - ' + $.toJSON(data).length + ' bytes');
			for(var i = 0; i < data.length; i++) {
				this.onEvent(session, data[i]);
			}
			setTimeout(_.bind(this.waitForEvents, this, session), this.poll_frequency);
		},
		waitForEvents: function(session) {
			this.client.query('update', null, session, _.bind(this.onEvents, this, (new Date()).getTime(), session), this.onConnectionError);
		}
	});
}).call(this);
