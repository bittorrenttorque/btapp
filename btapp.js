// Btapp.js 0.2.0

// (c) 2012 Patrick Williams, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

// Welcome to Btapp!

// This should provide a clean javascript layer above the utorrent/bittorrent
// webui layer (the web interface to a client). It is intended to abstract away
// everything but the objects and the functions that can be called on them.
// There's no need for someone writing  a web app that interacts with the client to
// constantly be doing diffs to see what has changed. In addition, calling long specific
// urls to call a single function on a torrent object is pretty painful, so I added
// functions that dangle off of the objects (in the bt object) that will call the urls
// that will achieve the desired effect and will also handle passing functions as arguments...
// this is similar to soap or rpc...so callbacks should *just work*...in fact, we internally
// rely on this as the  torrentStatus event function is set and the used to keep our models up to date

(function() {
    // some of us are lost in the world without __asm int 3;
    // lets give ourselves an easy way to blow the world up if we're not happy about something
    function assert(b, err) { if(!b) { debugger; throw err; } }
    
    var MAX_POLL_FREQUENCY = 3000;
    var MIN_POLL_FREQUENCY = 0;
    var POLL_FREQUENCY_BACKOFF_INCREMENT = 100;

    // BtappBase
    // -------------

    // BtappBase is *extend*-ed into both BtappModel and BtappCollection in the hopes of
    // reducing redundant code...both these types need a way to build up children elements
    // from data retrieved from the torrent client, as a way to clean that data up should
    // the client become unreachable.
    BtappBase = {
        initialize: function() {
            _.bindAll(this, 'initializeValues', 'updateState', 'clearState', 'isEmpty', 'destructor');
            this.initializeValues();
        },
        clearRemoteProcedureCalls: function() {
            var keys = _.keys(this.bt || {});
            for(var i = 0; i < keys.length; i++) {
                var key = keys[i]
                delete this.bt[key];
                delete this[key];
            }
            this.bt = {};
        },
        initializeValues: function() {
            this.path = null;
            this.session = null;
            this.clearRemoteProcedureCalls();
        },
        updateRemoveFunctionState: function(v) {
            //we have a special case for get...we never want the server rpc version
            assert(v in this.bt, 'trying to remove a function that does not exist');
            this.trigger('remove:bt:' + v);
            this.trigger('remove:bt', this.bt[v], v);
            delete this.bt[v];

            //for set and unset, we don't want to set them directly on the objects
            if(v === 'get' || v === 'set' || v === 'unset' || v === 'length') {
                return;
            }
                 
            assert(v in this, 'trying to remove the function "' + v + '", which does not exist in the prototype of this object');
            this.trigger('remove:' + v);
            delete this[v];
            return {};
        },
        updateRemoveObjectState: function(session, added, removed, childpath, v) {
            var ret = {};
            var model = this.get(v);
            assert(model, 'trying to remove a model that does not exist');
            assert('updateState' in model, 'trying to remove an object that does not extend BtappBase');
            model.updateState(session, added, removed, childpath);
            if(model.isEmpty()) {
                ret[v] = model;
                model.trigger('destroy');
            }
            return ret;
        },
        updateRemoveElementState: function(session, added, removed, v, path) {
            var childpath = _.clone(path || []);
            childpath.push(v);
            if(v === 'all') {
                return this.updateState(this.session, added, removed, childpath);
            } else if(typeof removed === 'object' && removed === null) {
                return this.updateRemoveAttributeState(v, removed);
            } else if(typeof removed === 'object') {
                return this.updateRemoveObjectState(session, added, removed, childpath, v);
            } else if(typeof removed === 'string' && TorrentClient.prototype.isRPCFunctionSignature(removed)) {
                return this.updateRemoveFunctionState(v);
            } else if(typeof removed === 'string' && TorrentClient.prototype.isJSFunctionSignature(removed)) {
                return this.updateRemoveAttributeState(v, this.client.getStoredFunction(removed));
            } else if(v != 'id') {
                return this.updateRemoveAttributeState(v, removed);
            }
        },
        updateRemoveState: function(session, add, remove, path) {
            var ret = {};
            for(var uv in remove) {
                if(add[uv] === undefined) {
                    _.extend(ret, this.updateRemoveElementState(session, add[uv], remove[uv], escape(uv), path));
                }
            }
            return ret;
        },
        updateAddFunctionState: function(session, added, path, v) {
            //we have a special case for get...we never want the server rpc version
            var childpath = _.clone(path || []);
            childpath.push(v);
            var func = this.client.createFunction(session, childpath, added);

            //set the function in the bt object...this is where we store just our rpc client functions
            assert(!(v in this.bt), 'trying to add a function that already exists');
            this.bt[v] = func;

            //also set it on the object directly...this ends up being how people expect to use the objects
            if(v !== 'get' && v !== 'set' && v !== 'unset' && v !== 'length') {
                assert(!(v in this), 'trying to add the function "' + v + '", which already exists in the prototype of this object');
                this[v] = func;
                this.trigger('add:' + v);
            }

            this.trigger('add:bt:' + v);
            this.trigger('add:bt', this.bt[v], v);

            return {};
        },
        updateAddObjectState: function(session, added, removed, childpath, v) {
            var ret = {};
            var model = this.get(v);
            if(model === undefined) {
                // Check if the path matches a valid collection path...if so that is the type that we should create
                if(BtappCollection.prototype.verifyPath(childpath)) {
                    model = new BtappCollection;
                } else {
                    model = new BtappModel({'id':v});
                }
                model.path = childpath;
                model.client = this.client;

                ret[v] = model;
            }
            model.updateState(this.session, added, removed, childpath);
            return ret;
        },
        updateAddElementState: function(session, added, removed, v, path) {
            var childpath = _.clone(path || []);
            childpath.push(v);

            //make sure we transform the removed variable to the correct js function if
            //removed is the string representation
            if(typeof removed === 'string' && TorrentClient.prototype.isJSFunctionSignature(removed)) {
                removed = this.client.getStoredFunction(removed);
            }


            // Special case all. It is a redundant layer that exists for the benefit of the torrent client
            if(v === 'all') {
                return this.updateState(this.session, added, removed, childpath);
            } else if(typeof added === 'object' && added === null) {
                return this.updateAddAttributeState(session, added, removed, childpath, v);
            } else if(typeof added === 'object') {
                return this.updateAddObjectState(session, added, removed, childpath, v);
            } else if(typeof added === 'string' && TorrentClient.prototype.isRPCFunctionSignature(added)) {
                return this.updateAddFunctionState(session, added, path, v);
            } else if(typeof added === 'string' && TorrentClient.prototype.isJSFunctionSignature(added)) {
                return this.updateAddAttributeState(session, this.client.getStoredFunction(added), removed, path, v);
            } else {
                return this.updateAddAttributeState(session, added, removed, childpath, v);
            }   
        },
        updateAddState: function(session, add, remove, path) {
            var ret = {};
            for(var uv in add) {
                _.extend(ret, this.updateAddElementState(session, add[uv], remove[uv], escape(uv), path));
            }
            return ret;
        },
        updateState: function(session, add, remove, path) {
            assert(!jQuery.isEmptyObject(add) || !jQuery.isEmptyObject(remove), 'the client is outputing empty objects("' + path + '")...these should have been trimmed off');
            this.session = session;
            if(!this.path) {
                this.path = path;
                //lets give our object the change to verify the path
                assert(this.verifyPath(this.path), 'cannot updateState with an invalid collection path');
            }

            add = add || {};
            remove = remove || {};

            this.applyStateChanges(
                this.updateAddState(session, add, remove, path),
                this.updateRemoveState(session, add, remove, path)
            );
        },
        sync: function() {
            //no sync for you
        }
    };

    // BtappCollection
    // -------------

    // BtappCollection is a collection of objects in the client...
    // currently this can only be used to represent the list of torrents,
    // then within the torrents, their list of files...this will eventually
    // be used for rss feeds, etc as well.
    BtappCollection = Backbone.Collection.extend(BtappBase).extend({
        initialize: function(models, options) {
            Backbone.Collection.prototype.initialize.apply(this, arguments);
            BtappBase.initialize.apply(this, arguments);

            this.on('add', this.customAddEvent, this);
            this.on('remove', this.customRemoveEvent, this);
            this.on('change', this.customChangeEvent, this);
        },
        customEvent: function(event, model) {
            //we want to ignore our internal add/remove events for our client rpc functions
            if(typeof model === 'function') return;

            assert(model && model.id, 'called a custom ' + event + ' event without a valid attribute');
            this.trigger(event + ':' + model.id, model);
        },
        customAddEvent: function(model) {
            this.customEvent('add', model);
        },
        customRemoveEvent: function(model) {
            this.customEvent('remove', model);
        },
        customChangeEvent: function(model) {
            this.customEvent('change', model);
        },
        destructor: function() {
            this.off('add', this.customAddEvent, this);
            this.off('remove', this.customRemoveEvent, this);
            this.off('change', this.customChangeEvent, this);
            this.trigger('destroy');
        },
        clearState: function() {
            this.each(function(model) { model.clearState(); });
            this.initializeValues();
            this.reset();
            this.destructor();
        },
        verifyPath: function(path) {
            var collections = [
                ['btapp', 'torrent'],
                ['btapp', 'torrent', 'all', '*', 'file'],
                ['btapp', 'torrent', 'all', '*', 'peer'],
                ['btapp', 'label'],
                ['btapp', 'label', 'all', '*', 'torrent'],
                ['btapp', 'label', 'all', '*', 'torrent', 'all', '*', 'file'],
                ['btapp', 'label', 'all', '*', 'torrent', 'all', '*', 'peer'],
                ['btapp', 'rss_feed'],
                ['btapp', 'rss_feed', 'all', '*', 'item'],
                ['btapp', 'rss_filter'],
                ['btapp', 'stream'],
                ['btapp', 'stream', 'all', '*', 'diskio']
            ];

            return _.any(collections, function(collection) {
                if(collection.length !== path.length) return false;
                for(var i = 0; i < collection.length; i++) {
                    if(collection[i] === '*') continue;
                    if(collection[i] !== path[i]) return false;
                }
                return true;
            });
        },
        updateRemoveAttributeState: function(v, removed) {
            throw 'trying to remove an invalid type from a BtappCollection';
        },
        updateAddAttributeState: function(session, added, removed, childpath, v) {
            throw 'trying to add an invalid type to a BtappCollection';
        },
        isEmpty: function() {
            return jQuery.isEmptyObject(this.bt) && this.length === 0;
        },
        applyStateChanges: function(add, remove) {
            this.add(_.values(add));
            this.remove(_.values(remove));
        }
    });

    // BtappModel
    // -------------

    // BtappModel is the base model for most things in the client
    // a torrent is a BtappModel, a file is a BtappModel, properties that
    // hang off of most BtappModels is also a BtappModel...both BtappModel
    // and BtappCollection objects are responsible for taking the json object
    // that is returned by the client and turning that into attributes/functions/etc
    BtappModel = Backbone.Model.extend(BtappBase).extend({
        initialize: function(attributes) {
            Backbone.Model.prototype.initialize.apply(this, arguments);
            BtappBase.initialize.apply(this, arguments);

            this.on('change', this.customEvents, this);
        },
        destructor: function() {
            this.off('change', this.customEvents, this);
            this.trigger('destroy');
        },
        clearState: function() {
            this.initializeValues();
            var clone = _.clone(this.attributes);
            delete clone['id'];
            _.each(clone, function(attribute) { 
                attribute && attribute.clearState && attribute.clearState(); 
            });
            Backbone.Model.prototype.set.call(this, clone, {internal: true, unset: true});
            this.destructor();
        },
        customEvents: function() {
            var attributes = this.changedAttributes();
            _.each(attributes, _.bind(function(value, key) {
                //check if this is a value that has been unset
                if(value === undefined) {
                    var prev = this.previous(key);
                    this.trigger('remove', prev, key);
                    this.trigger('remove:' + key, prev);
                } else if(this.previous(key) === undefined) {
                    this.trigger('add', value, key);
                    this.trigger('add:' + key, value);
                }
            }, this));
        },
        verifyPath: function(path) {
            return true;
        },
        updateRemoveAttributeState: function(v, removed) {
            var ret = {};
            removed = typeof removed === 'string' ? unescape(removed) : removed;
            assert(this.get(v) === removed, 'trying to remove an attribute, but did not provide the correct previous value');
            ret[v] = this.get(v);
            return ret;
        },
        updateAddAttributeState: function(session, added, removed, childpath, v) {
            var ret = {};
            // Set non function/object variables as model attributes
            added = (typeof added === 'string') ? unescape(added) : added;
            assert(!(this.get(v) === added), 'trying to set a variable to the existing value [' + childpath + ' -> ' + JSON.stringify(added) + ']');
            if(!(removed === undefined)) {
                removed = (typeof removed === 'string') ? unescape(removed) : removed;
                assert(this.get(v) === removed, 'trying to update an attribute, but did not provide the correct previous value');
            }
            ret[v] = added;
            return ret;
        },
        isEmpty: function() {
            var keys = _.keys(this.toJSON());
            return jQuery.isEmptyObject(this.bt) && (keys.length === 0 || (keys.length === 1 && keys[0] === 'id'));
        },
        applyStateChanges: function(add, remove) {
            Backbone.Model.prototype.set.call(this, add, {internal: true});
            Backbone.Model.prototype.set.call(this, remove, {internal: true, unset: true});
        },
        set: function(key, value, options) {
            var evaluate = function(value, key) {
                if(options && 'internal' in options) return;
                if(typeof this.get(key) === 'undefined') return;  
                // We're trying to guide users towards using save
                throw 'please use save to set attributes directly to the client';
            };

            // This code is basically right out of the Backbone.Model set code.
            // Have to handle a variety of function signatures
            if (_.isObject(key) || key == null) {
               _(key).each(evaluate, this);
            } else {
                evaluate.call(this, value, key);
            }

            return Backbone.Model.prototype.set.apply(this, arguments);
        },
        save: function(attributes, options) {
            var deferreds = [];
            _(attributes).each(function(value, key) {
                deferreds.push(this.bt.set(key, value));
            }, this);
            return jQuery.when.apply(jQuery, deferreds);
        }
    });

    // Btapp
    // -------------


    // Btapp is the root of the client objects' tree, and generally the only object that clients should instantiate.
    // This mirrors the original api where document.btapp was the root of everything. generally, this api attempts to be
    // as similar as possible to that one...
    Btapp = BtappModel.extend({
        initialize: function() {
            BtappModel.prototype.initialize.apply(this, arguments);

            this.path = ['btapp'];
            this.connected_state = false;
            this.client = null;
            this.queries = null;
            this.session = null;
            this.last_query = null;

            //bind stuff
            _.bindAll(this, 'connect', 'disconnect', 'connected', 'fetch', 'onEvents', 'onFetch', 'onConnectionError');
            this.on('add:events', this.setEvents, this);
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
            assert(!this.session, 'trying to create another session while one is active');


            // Initialize variables
            attributes = attributes || {};
            this.poll_frequency = MIN_POLL_FREQUENCY;
            this.queries = attributes.queries || Btapp.QUERIES.ALL;


            var error = 'the queries attribute must be an array of arrays of strings';
            assert(typeof this.queries === 'object', error);
            assert(this.queries && typeof this.queries === 'object' && _.all(this.queries, function(query) {
                return typeof query === 'object' && _.all(query, function(segment) {
                    return typeof segment === 'string';
                });
            }), error);

            // At this point, if a username password combo is provided we assume that we're trying to
            // access a falcon client. If not, default to the client running on your local machine.
            // You can also pass in "remote_data" that is returned from a falcon.serialize()
            attributes.btapp = this;

            // We'll check for TorrentClient and assume that FalconTorrentClient and LocalTorrentClient
            // come along for the ride.
            if(typeof TorrentClient === 'undefined') {
                jQuery.getScript(
                    'https://torque.bittorrent.com/btapp/client.btapp.js',
                    _.bind(this.setClient, this, attributes)
                );
            } else {
                this.setClient(attributes);
            }
        },
        setClient: function(attributes) {
            if(('username' in attributes && 'password' in attributes) || 'remote_data' in attributes) {
                this.client = new FalconTorrentClient(attributes);
            } else {
                this.client = new LocalTorrentClient(attributes);
            }
            // While we don't want app writers having to interact with the client directly,
            // it would be nice to be able to listen in on what's going on...so let em bubble up
            this.client.bind('all', this.trigger, this);
            this.client.bind('client:connected', this.fetch);       
        },
        setEvents: function(events) {
            // For each client event, just set it to trigger an javascript side event
            // using the same name. This way you can just bind to the base btapp objects
            // instead of understanding the slightly unconventional save mechanics. 
            _.each(events.toJSON(), function(value, key) {
                if(key !== 'id') {
                    var tmp = {};
                    tmp[key] = _.bind(this.trigger, this, key);
                    events.save(tmp);
                }
            }, this);       
        },
        disconnect: function() {
            assert(this.client, 'trying to disconnect from an undefined client');
            assert(this.connected_state, 'trying to disconnect when not connected');
            this.connected_state = false;

            //make sure that the last request never resolves and messes up our state
            if(this.last_query) {
                this.last_query.abort();
                this.last_query = null;
            }

            this.session = null;
            if (this.next_timeout) {
                clearTimeout( this.next_timeout );
            }
            this.client.disconnect();
            this.client.btapp = null;
            this.client = null;
            this.queries = null;
            this.clearState();
        },
        connected: function() {
            return this.connected_state;
        },
        onConnectionError: function() {
            //something terrible happened...back off abruptly
            this.poll_frequency = MAX_POLL_FREQUENCY;
            this.clearState();
            this.session = null;
            if(this.last_query) {
                this.last_query.abort();
                this.last_query = null;
            }
            
            if(this.client) {
                _.delay(_.bind(this.client.reset, this.client), 500);
            }
        },
        onFetch: function(data) {
            assert('session' in data, 'did not recieve a session id from the client');
            this.session = data.session;
            this.waitForEvents(data.session);
        },
        fetch: function() {
            if(this.client) {
                this.last_query = this.client.query({
                    type: 'state', 
                    queries: JSON.stringify(this.queries)
                }).done(this.onFetch).fail(this.onConnectionError);
            }
        },
        onEvent: function(session, data) {
            // There are two types of events...state updates and callbacks
            // Handle state updates the same way we handle the initial tree building
            if('add' in data || 'remove' in data) {
                data.add = data.add || {};
                data.remove = data.remove || {};
                this.updateState(session, data.add.btapp, data.remove.btapp, ['btapp']);
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
        onEvents: function(session, data) {
            assert(this.session === session, 'should not receive data for a different session after creating a new one. do not forget to abort the last call of your old session.');
            if(this.connected_state) {
                this.trigger('sync', data);
                //do a little bit of backoff if these requests are empty
                if(data.length == 0) {
                    this.poll_frequency = Math.min(MAX_POLL_FREQUENCY, 
                        this.poll_frequency + POLL_FREQUENCY_BACKOFF_INCREMENT);
                } else {
                    this.poll_frequency = MIN_POLL_FREQUENCY;
                }
                for(var i = 0; i < data.length; i++) {
                    this.onEvent(session, data[i]);
                }
                this.next_timeout = setTimeout(_.bind(this.waitForEvents, this, session), this.poll_frequency);
            }
        },
        waitForEvents: function(session) {
            if(this.client) {
                this.last_query = this.client.query({
                    type: 'update',
                    session: session
                }).done(_.bind(this.onEvents, this, session)).fail(this.onConnectionError);
            }
        }
    });

    Btapp.VERSION = '0.1.0';
    Btapp.QUERIES = {
        ALL: [['btapp']],
        DHT: [['btapp','dht']],
        TORRENTS_BASIC: [
            ['btapp','create'], 
            ['btapp','add','torrent'],
            ['btapp','torrent','all','*','file','all','*'], 
            ['btapp','torrent','all','*','properties','all','*']
        ],
        EVENTS: [['btapp','events']],
        SETTINGS: [['btapp','settings']],
        REMOTE: [
            ['btapp','connect_remote'], 
            ['btapp','settings','all','webui.uconnect_enable']
        ]
    };
    // These are the various state values that might be set in the object recieved in event callbacks
    Btapp.STATUS = {
        TORRENT: {
            DELETED: -1,
            DOWNLOAD_FAILED: 0,
            ADDED: 1,
            COMPLETE: 2,
            METADATA_COMPLETE: 3
        },
        RSS_FEED: {
            DELETED: -1,
            ADDED: 1
        }
    };
    // These are the valid options to pass as the optional argument to torrents' remove function
    Btapp.REMOVE = {
        NO_DELETE: 0,
        DELETE_TORRENT: 1,
        DELETE_DATA: 2,
        DELETE_BOTH: 3,
        DELETE_TO_TRASH: 4,
        DELETE_CONVERTED_FILES: 5
    };

    Btapp.TORRENT = {
        // These are the valid priority levels that you can pass to torrents' set_priority function
        PRIORITY: {
            LOW: 0,
            MEDIUM: 1,
            HIGH: 2,
            METADATA_ONLY: 3 //Means that once the metadata has been downloaded, the torrent stops
        },
        FILE: {
            PRIORITY: {
                NO_DOWNLOAD: 0,
                LOW: 5,
                MEDIUM: 10, 
                HIGH: 15
            }
        },
        //Arguments meant for use with the remove function dangling off of torrents
        REMOVE: {
            NO_DELETE: 0, //stops and removes the torrent from the client
            DELETE_TORRENT: 1, // removes from client and deletes the .torrent file
            DELETE_DATA: 2, // removes from client and deletes the torrent file data
            DELETE_TORRENT_AND_DATA: 3 //removes from client and deletes the .torrent file and data
        }
    };
}).call(this);