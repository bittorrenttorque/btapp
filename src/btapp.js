define([
    'jquery',
    'underscore',
    'backbone',
    'rpc.btapp',
    'model.btapp',
    // load the collection as well to solve requirejs loops
    'collection.btapp'
], function (jQuery, _, Backbone, RPC, BtappModel) {
    'use strict';
    // some of us are lost in the world without __asm int 3;
    // lets give ourselves an easy way to blow the world up if we're not happy about something
    var assert = function (b, err) { if (!b) { throw err; } };

    var MAX_POLL_FREQUENCY = 10000;
    var MIN_POLL_FREQUENCY = 500;
    var POLL_FREQUENCY_BACKOFF_INCREMENT = 500;

    // Btapp
    // -------------


    // Btapp is the root of the client objects' tree, and generally the only object that clients should instantiate.
    // This mirrors the original api where document.btapp was the root of everything. generally, this api attempts to be
    // as similar as possible to that one...
    var Btapp = BtappModel.extend({
        initialize: function () {
            BtappModel.prototype.initialize.apply(this, arguments);

            this.ajax = Btapp.ajax;
            this.path = ['btapp'];
            this.connectedState = false;
            this.rpc = null;
            this.queries = null;
            this.session = null;
            this.lastQuery = null;
        },
        destructor: function () {
            // We don't want to destruct the base object even when we can't connect...
            // Its event bindings are the only way we'll known when we've re-connected
            // WARNING: this might leak a wee bit if you have numerous connections in your app
        },
        connect: function (attributes) {
            assert(!this.rpc, 'trying to connect to an undefined client');
            assert(!this.connectedState, 'trying to connect when already connected');
            this.connectedState = true;
            assert(!this.session, 'trying to create another session while one is active');


            // Initialize variables
            attributes = attributes || {};
            this.pollFrequency = MIN_POLL_FREQUENCY;
            this.queries = attributes.queries || [['btapp']];



            var error = 'the queries attribute must be an array of arrays of strings';
            assert(_.isArray(this.queries), error);
            assert(_.all(this.queries, function (query) {
                return _.isArray(query) && _.all(query, function (segment) {
                    return _.isString(segment);
                });
            }), error);

            assert(_.has(attributes, 'port'), 'port must be specified');

            // At this point, if a username password combo is provided we assume that we're trying to
            // access a falcon client. If not, default to the client running on your local machine.
            // You can also pass in "remote_data" that is returned from a falcon.serialize()

            this.rpc = new RPC(attributes);
            this.fetch();
        },
        disconnect: function () {
            this.trigger('disconnect', 'manual');
            assert(this.rpc, 'trying to disconnect from an undefined client');
            assert(this.connectedState, 'trying to disconnect when not connected');

            //as a courtesy to the client maintaining state for all connections,
            //let notify it that we no longer require its services.
            if (this.session) {
                this.rpc.query({
                    type: 'disconnect',
                    session: this.session
                });
            }

            this.connectedState = false;

            //make sure that the last request never resolves and messes up our state
            if (this.lastQuery) {
                this.lastQuery.abort();
                this.lastQuery = null;
            }

            this.session = null;
            if (this.nextTimeout) {
                clearTimeout(this.nextTimeout);
            }
            this.rpc.disconnect();
            this.rpc = null;
            this.queries = null;
            this.clearState();
        },
        connected: function () {
            return this.connectedState;
        },
        onConnectionError: function () {
            //something terrible happened...back off abruptly
            this.pollFrequency = MAX_POLL_FREQUENCY;
            this.clearState();
            this.session = null;
            if (this.lastQuery) {
                this.lastQuery.abort();
                this.lastQuery = null;
            }
        },
        onFetch: function (data) {
            assert('session' in data, 'did not recieve a session id from the client');
            this.session = data.session;
            this.waitForEvents(data.session);
        },
        fetch: function () {
            if (this.rpc) {
                this.lastQuery = this.rpc.query({
                    type: 'state',
                    queries: JSON.stringify(this.queries)
                }).done(_.bind(this.onFetch, this)).fail(_.bind(this.onConnectionError, this));
            }
        },
        onEvent: function (session, data) {
            // There are two types of events...state updates and callbacks
            // Handle state updates the same way we handle the initial tree building
            if ('add' in data || 'remove' in data) {
                data.add = data.add || {};
                data.remove = data.remove || {};
                this.updateState(session, data.add.btapp, data.remove.btapp, ['btapp']);
            } else if ('callback' in data) {
                this.rpc.btappCallbacks[data.callback](data['arguments']);
            } else {
                throw 'received invalid data from the client';
            }
        },
        // When we get a poll response from the client, we sort through them here, as well as track round trip time.
        // We also don't fire off another poll request until we've finished up here, so we don't overload the client if
        // it is generating a large diff tree. We should generally on get one element in data array. Anything more and
        // the client has wasted energy creating seperate diff trees.
        onEvents: function (session, data) {
            assert(this.session === session, 'should not receive data for a different session after creating a new one. do not forget to abort the last call of your old session.');
            if (this.connectedState) {
                this.trigger('sync', data);
                //do a little bit of backoff if these requests are empty
                if (data.length === 0) {
                    this.pollFrequency = Math.min(MAX_POLL_FREQUENCY,
                        this.pollFrequency + POLL_FREQUENCY_BACKOFF_INCREMENT);
                } else {
                    this.pollFrequency = MIN_POLL_FREQUENCY;
                }
                for (var i = 0; i < data.length; i++) {
                    this.onEvent(session, data[i]);
                }
                clearTimeout(this.nextTimeout);
                this.nextTimeout = setTimeout(_.bind(this.waitForEvents, this, session), this.pollFrequency);
            }
        },
        waitForEvents: function (session) {
            if (this.rpc) {
                this.lastQuery = this.rpc.query({
                    type: 'update',
                    session: session
                }).done(_.bind(this.onEvents, this, session)).fail(_.bind(this.onConnectionError, this));
            }
        }
    });

    Btapp.ajax = jQuery.ajax;

    return Btapp;
});