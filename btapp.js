// Btapp.js 4.2.1

// (c) 2012 Patrick Williams, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

// Welcome to Btapp!

// This should provide a clean javascript layer above the utorrent/bittorrent
// webui layer (the web interface to a client). It is intended to abstract away
// everything but the objects and the functions that can be called on them.
// There's no need for someone writing	a web app that interacts with the client to
// constantly be doing diffs to see what has changed. In addition, calling long specific
// urls to call a single function on a torrent object is pretty painful, so I added
// functions that dangle off of the objects (in the bt object) that will call the urls
// that will achieve the desired effect and will also handle passing functions as arguments...
// this is similar to soap or rpc...so callbacks should *just work*...in fact, we internally
// rely on this as the	torrentStatus event function is set and the used to keep our models up to date


// some of us are lost in the world without __asm int 3;
// lets give ourselves an easy way to blow the world up if we're not happy about something
function assert(b, err) { if(!b) throw err; }

// BtappBase
// -------------

// BtappBase is *extend*-ed into both BtappModel and BtappCollection in the hopes of
// reducing redundant code...both these types need a way to build up children elements
// from data retrieved from the torrent client, as a way to clean that data up should
// the client become unreachable.
window.BtappBase = {
	initialize: function() {
		_.bindAll(this, 'initializeValues', 'updateState', 'clearState');
		this.initializeValues();
	},
	initializeValues: function() {
		this.bt = {};
		this.url = null;
		this.session = null;
	},
	updateState: function(session, add, remove, url) {
		assert(!jQuery.isEmptyObject(add) || !jQuery.isEmptyObject(remove), 'the client is outputing empty objects("' + url + '")...these should have been trimmed off');
		this.session = session;
		if(!this.url) {
			this.url = url;
			//lets give our object the change to verify the url
			assert(this.verifyUrl(this.url), 'cannot updateState with an invalid collection url');
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
		this.updateAddState(session, add, remove, url);
		this.updateRemoveState(session, add, remove, url);
	},
	clearState: function() {
		//we want to call clearState on all child elements
		this.attributes && _.each(this.attributes, function(attribute) { attribute.clearState && attribute.clearState(); });
		this.each && this.each(function(model) { model.clearState(); });
	
		//once child elements have been cleared, just blow away our children elements
		this.reset && this.reset();
		this.clear && this.clear();
		
		this.destructor();
		this.initializeValues();
	}
};

// BtappCollection
// -------------

// BtappCollection is a collection of objects in the client...
// currently this can only be used to represent the list of torrents,
// then within the torrents, their list of files...this will eventually
// be used for rss feeds, etc as well.
window.BtappCollection = Backbone.Collection.extend(BtappBase).extend({
	initialize: function(models, options) {
		Backbone.Collection.prototype.initialize.apply(this, arguments);
		BtappBase.initialize.apply(this, arguments);
		_.bindAll(this, 'destructor', 'customAddEvent', 'customRemoveEvent', 'customChangeEvent');
		
		this.bind('add', this.customAddEvent);
		this.bind('remove', this.customRemoveEvent)
		this.bind('change', this.customChangeEvent);
	},
	customAddEvent: function(model) {
		assert(model, 'called a custom event without a valid attribute');
		this.trigger('add:' + model.id, model);
	},
	customRemoveEvent: function(model) {
		assert(model, 'called a custom event without a valid attribute');
		this.trigger('remove:' + model.id, model);
	},
	customChangeEvent: function(model) {
		assert(model, 'called a custom event without a valid attribute');
		this.trigger('change:' + model.id, model);
	},
	destructor: function() {
		this.unbind('add', this.customAddEvent);
		this.unbind('remove', this.customRemoveEvent)
		this.unbind('change', this.customChangeEvent);
		this.trigger('destroy');
	},
	verifyUrl: function(url) {
		return url.match(/btapp\/torrent\/$/) ||
			url.match(/btapp\/torrent\/all\/[^\/]+\/file\/$/) ||
			url.match(/btapp\/torrent\/all\/[^\/]+\/peer\/$/) ||
			url.match(/btapp\/label\/$/) ||
			url.match(/btapp\/label\/all\/[^\/]+\/torrent\/$/) ||
			url.match(/btapp\/label\/all\/[^\/]+\/torrent\/all\/[^\/]+\/file\/jQuery/) ||
			url.match(/btapp\/label\/all\/[^\/]+\/torrent\/all\/[^\/]+\/peer\/jQuery/) ||
			url.match(/btapp\/rss_feed\/$/) ||
			url.match(/btapp\/rss_feed\/all\/[^\/]+\/item\/$/) ||
			url.match(/btapp\/rss_filter\/$/);
	},
	updateRemoveObjectState: function(session, added, removed, childurl, v, attributes) {
		var model = this.get(v);
		assert(model, 'trying to remove a model that does not exist');
		model.updateState(session, added, removed, childurl);
		this.remove(model);
	},
	updateRemoveFunctionState: function(v) {
		assert(v in this.bt, 'trying to remove a function that does not exist');
		delete this.bt[v];
	},
	updateRemoveAttributeState: function(v, removed) {
		throw 'trying to remove an invalid type from a BtappCollection';
	},
	updateRemoveState: function(session, add, remove, url) {
		// Iterate over the diffs that came from the client to see what has been added (only in add),
		// removed (only in remove), or changed (old value in remove, new value in add)
		for(var uv in remove) {
			var added = add[uv];
			var removed = remove[uv];
			var v = escape(uv);
			var childurl = url + v + '/';


			// Elements that are in remove aren't necessarily being removed,
			// they might alternatively be the old value of a variable that has changed
			if(added === undefined) {
				// Most native objects coming from the client have an "all" layer before their variables,
				// There is no need for the additional layer in javascript so we just flatten the tree a bit.
				if(v === 'all') {
					this.updateState(this.session, added, removed, childurl);
					continue;
				}

				// We only expect objects and functions to be added to collections
				if(typeof removed === 'object') {
					this.updateRemoveObjectState(session, added, removed, childurl, v);
				} else if(typeof removed === 'string' && TorrentClient.prototype.isFunctionSignature(removed)) {
					this.updateRemoveFunctionState(v);
				} else {
					this.updateRemoveAttributeState(v, removed);
				}
			}
		}
	},
	updateAddObjectState: function(session, added, removed, childurl, v) {
		var model = this.get(v);
		if(model === undefined) {
			model = new BtappModel({'id':v});
			model.url = childurl;
			model.client = this.client;
			model.updateState(this.session, added, removed, childurl);
			this.add(model);
		} else {
			model.updateState(this.session, added, removed, childurl);
		}
	},
	updateAddFunctionState: function(session, added, url, v) {
		assert(!(v in this.bt), 'trying to add a function that already exists');
		this.bt[v] = this.client.createFunction(session, url + v, added);
	},
	updateAddAttributeState: function(session, added, removed, childurl, v) {
		throw 'trying to add an invalid type to a BtappCollection';
	},
	updateAddState: function(session, add, remove, url) {
		for(var uv in add) {
			var added = add[uv];
			var removed = remove[uv];
			var v = escape(uv);
			var childurl = url + v + '/';

			// Most native objects coming from the client have an "all" layer before their variables,
			// There is no need for the additional layer in javascript so we just flatten the tree a bit.
			if(v === 'all') {
				this.updateState(this.session, added, removed, childurl);
				continue;
			}

			if(typeof added === 'object') {
				this.updateAddObjectState(session, added, removed, childurl, v);
			} else if(typeof added === 'string' && TorrentClient.prototype.isFunctionSignature(added)) {
				this.updateAddFunctionState(session, added, url, v);
			} else {
				this.updateAddAttributeState(session, added, removed, childurl, v);
			}
		}
	}
});

// BtappModel
// -------------

// BtappModel is the base model for most things in the client
// a torrent is a BtappModel, a file is a BtappModel, properties that
// hang off of most BtappModels is also a BtappModel...both BtappModel
// and BtappCollection objects are responsible for taking the json object
// that is returned by the client and turning that into attributes/functions/etc
window.BtappModel = Backbone.Model.extend(BtappBase).extend({
	initialize: function(attributes) {
		Backbone.Model.prototype.initialize.apply(this, arguments);
		BtappBase.initialize.apply(this, arguments);
		_.bindAll(this, 'destructor', 'customEvents');
		
		this.bind('change', this.customEvents);
	},
	destructor: function() {
		this.unbind('change', this.customEvents);
		this.trigger('destroy');
	},
	customEvents: function() {
		var attributes = this.changedAttributes();
		_.each(attributes, _.bind(function(value, key) {
			//check if this is a value that has been unset
			if(value === undefined) {
				var prev = this.previous(key);
				this.trigger('remove', prev);
				this.trigger('remove:' + key, prev);
			} else if(this.previous(key) === undefined) {
				this.trigger('add', value);
				this.trigger('add:' + key, value);
			}
		}, this));
	},
	verifyUrl: function(url) {
		return true;
	},
	updateRemoveObjectState: function(session, added, removed, childurl, v, attributes) {
		//Update state downstream from here. Then remove from the collection.
		var model = this.get(v);
		assert(model, 'trying to remove a model that does not exist');
		assert(model instanceof BtappModel || model instanceof BtappCollection, 'expected removed attribute to be an instance of BtappModel or BtappCollection');
		model.updateState(session, added, removed, childurl);
		attributes[v] = this.get(v);
	},
	updateRemoveFunctionState: function(v) {
		assert(v in this.bt, 'trying to remove a function that does not exist');
		delete this.bt[v];
	},
	updateRemoveAttributeState: function(v, removed, attributes) {
		removed = typeof removed === 'string' ? unescape(removed) : removed;
		assert(this.get(v) === removed, 'trying to remove an attribute, but did not provide the correct previous value');
		attributes[v] = this.get(v);
	},
	updateRemoveState: function(session, add, remove, url) {
		var attributes = {};
		for(var uv in remove) {
			var added = add[uv];
			var removed = remove[uv];
			var v = escape(uv);
			var childurl = url + v + '/';

			if(added === undefined) {
				//special case all
				if(v === 'all') {
					this.updateState(this.session, added, removed, childurl);
					continue;
				}

				if(typeof removed === 'object') {
					this.updateRemoveObjectState(session, added, removed, childurl, v, attributes);
				} else if(typeof removed === 'string' && TorrentClient.prototype.isFunctionSignature(removed)) {
					this.updateRemoveFunctionState(v);
				} else if(v != 'id') {
					this.updateRemoveAttributeState(v, removed, attributes);
				}
			}
		}
		this.set(attributes, {'unset': true});
	},
	updateAddObjectState: function(session, added, removed, childurl, v, attributes) {
		// Don't recreate a variable we already have. Just update it.
		var model = this.get(v);
		if(model === undefined) {
			// This is the only hard coding that we should do in this library...
			// As a convenience, torrents and their file/peer lists are treated as backbone collections
			// the same is true of rss_feeds and filters...its just a more intuitive way of using them
			if(BtappCollection.prototype.verifyUrl(childurl)) {
				model = new BtappCollection;
			} else {
				model = new BtappModel({'id':v});
			}
			model.url = childurl;
			model.client = this.client;
			attributes[escape(v)] = model;
		}
		model.updateState(this.session, added, removed, childurl);
	},
	updateAddFunctionState: function(session, added, url, v) {
		assert(!(v in this.bt), 'trying to add a function that already exists');
		this.bt[v] = this.client.createFunction(session, url + v, added);
	},
	updateAddAttributeState: function(session, added, removed, childurl, v, attributes) {
		// Set non function/object variables as model attributes
		added = (typeof added === 'string') ? unescape(added) : added;
		assert(!(this.get(escape(v)) === added), 'trying to set a variable to the existing value [' + childurl + ' -> ' + JSON.stringify(added) + ']');
		if(!(removed === undefined)) {
			assert(this.get(escape(v)) === removed, 'trying to update an attribute, but did not provide the correct previous value');
		}
		attributes[escape(v)] = added;
	},
	updateAddState: function(session, add, remove, url) {
		var attributes = {};
		for(var uv in add) {
			var added = add[uv];
			var removed = remove[uv];
			var v = escape(uv);
			var childurl = url + v + '/';

			// Special case all. It is a redundant layer that exist for the benefit of the torrent client
			if(v === 'all') {
				this.updateState(this.session, added, removed, childurl);
				continue;
			}

			if(typeof added === 'object') {
				this.updateAddObjectState(session, added, removed, childurl, v, attributes);
			} else if(typeof added === 'string' && TorrentClient.prototype.isFunctionSignature(added)) {
				this.updateAddFunctionState(session, added, url, v);
			} else {
				this.updateAddAttributeState(session, added, removed, childurl, v, attributes);
			}	
		}
		this.set(attributes);
	}
});

// Btapp
// -------------


// Btapp is the root of the client objects' tree, and generally the only object that clients should instantiate.
// This mirrors the original api where document.btapp was the root of everything. generally, this api attempts to be
// as similar as possible to that one...

// BEFORE:
// *btapp.torrent.get('XXX').file.get('XXX').properties.get('name');*
// AFTER:
// *btapp.get('torrent').get('XXX').get('file').get('XXX').get('properties').get('name');*

// The primary difference is that in the original you got the state at that exact moment, where
// we now simply keep the backbone objects up to date (by quick polling and updating as diffs are returned)
// so you can query at your leisure.
window.Btapp = BtappModel.extend({
	initialize: function() {
		BtappModel.prototype.initialize.apply(this, arguments);

		this.url = 'btapp/';
		this.connected_state = false;
		this.client = null;

		//bind stuff
		_.bindAll(this, 'connect', 'disconnect', 'connected', 'fetch', 'onEvents', 'onFetch', 'onConnectionError');
	},
	destructor: function() {
		// We don't want to destruct the base object even when we can't connect...
		// Its event bindings are the only way we'll known when we've re-connected
		// WARNING: this might leak a wee bit if you have numerous connections in your app
	},
	connect: function(attributes) {
		assert(!this.client, 'trying to connect to an undefined client');
		assert(!this.connected_state, 'trying to connect when already connected');
		this.connected_state = true;

		// Initialize variables
		attributes = attributes || {};
		this.poll_frequency = attributes.poll_frequency || 3000;
		this.queries = attributes.queries || ['btapp/'];

		// At this point, if a username password combo is provided we assume that we're trying to
		// access a falcon client. If not, default to the client running on your local machine.
		// You can also pass in "remote_data" that is returned from a falcon.serialize()
		attributes.btapp = this;

		// We'll check for TorrentClient and assume that FalconTorrentClient and LocalTorrentClient
		// come along for the ride.
		if(window.TorrentClient) {
			this.setClient(attributes);
		} else {
			jQuery.getScript(
				'http://apps.bittorrent.com/torque/btapp/torque.btapp.js',
			_.bind(this.setClient, this, attributes)
			);
		}
	},
	setClient: function(attributes) {
		if(('username' in attributes && 'password' in attributes) || 'remote_data' in attributes) {
			this.client = new FalconTorrentClient(attributes);
		} else {
			this.client = new LocalTorrentClient(attributes);
		}
		// While we don't want app writers having to interact with the client directly,
		// it would be nice to be able to listen in on what's going on...so lets just bubble
		// them up as client:XXX messages
		this.client.bind('all', this.trigger, this);
		this.client.bind('client:connected', this.fetch);		
	},
	disconnect: function() {
		assert(this.client, 'trying to disconnect from an undefined client');
		assert(this.connected_state, 'trying to disconnect when not connected');
		this.connected_state = false;
		if (this.next_timeout) {
			clearTimeout( this.next_timeout );
		}
		this.client.btapp = null;
		this.client = null;
		this.clearState();
	},
	connected: function() {
		return this.connected_state;
	},
	onConnectionError: function() {
		this.clearState();
		if(this.client) {
			this.client.reset();
		}
	},
	onFetch: function(data) {
		assert('session' in data, 'did not recieve a session id from the client');
		this.waitForEvents(data.session);
	},
	fetch: function() {
		if(this.client) {
			this.client.query('state', this.queries, null, this.onFetch, this.onConnectionError);
		}
	},
	onEvent: function(session, data) {
		this.trigger('sync', data);
		// There are two types of events...state updates and callbacks
		// Handle state updates the same way we handle the initial tree building
		if('add' in data || 'remove' in data) {
			data.add = data.add || {};
			data.remove = data.remove || {};
			this.updateState(session, data.add.btapp, data.remove.btapp, 'btapp/');
		} else if('callback' in data && 'arguments' in data) {
			this.client.btappCallbacks[data.callback](data.arguments);
		} else {
			throw 'received invalid data from the client';
		}
	},
	// When we get a poll response from the client, we sort through them here, as well as track round trip time.
	// We also don't fire off another poll request until we've finished up here, so we don't overload the client if
	// it is generating a large diff tree. We should generally on get one element in data array. Anything more and
	// the client has wasted energy creating seperate diff trees.
	onEvents: function(time, session, data) {
		if(this.connected_state) {
			for(var i = 0; i < data.length; i++) {
				this.onEvent(session, data[i]);
			}
			this.next_timeout = setTimeout(_.bind(this.waitForEvents, this, session), this.poll_frequency);
		}
	},
	waitForEvents: function(session) {
		if(this.client) {
			this.client.query('update', null, session, _.bind(this.onEvents, this, (new Date()).getTime(), session), this.onConnectionError);
		}
	}
});

//The version of this library should always match the version of torque that it requires.
Btapp.VERSION = '4.2.1'
