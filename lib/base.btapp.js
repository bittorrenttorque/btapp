define([
    'require',
    'backbone',
    'underscore',
    'jquery',
    'rpc.btapp',
    'collection.btapp'
], function (require, Backbone, _, jQuery, RPC) {
    'use strict';
    // some of us are lost in the world without __asm int 3;
    // lets give ourselves an easy way to blow the world up if we're not happy about something
    var assert = function (b, err) { if (!b) { throw err; } };

    var isEmptyObject = function (obj) {
        return _.isObject(obj) && !_.isArray(obj) &&  jQuery.isEmptyObject(obj);
    };

    // BtappBase
    // -------------

    // BtappBase is *extend*-ed into both BtappModel and BtappCollection in the hopes of
    // reducing redundant code...both these types need a way to build up children elements
    // from data retrieved from the torrent client, as a way to clean that data up should
    // the client become unreachable.
    var BtappBase = {
        initialize: function () {
            this.initializeValues();
        },
        clearRemoteProcedureCalls: function () {
            var keys = _.keys(this.bt || {});
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                delete this.bt[key];
                delete this[key];
            }
            this.bt = {};
        },
        initializeValues: function () {
            this.path = null;
            this.session = null;
            this.clearRemoteProcedureCalls();
        },
        updateRemoveFunctionState: function (v) {
            //we have a special case for get...we never want the server rpc version
            assert(v in this.bt, 'trying to remove a function that does not exist');
            this.trigger('remove:bt:' + v);
            this.trigger('remove:bt', this.bt[v], v);
            delete this.bt[v];

            //for set and unset, we don't want to set them directly on the objects
            if (v === 'keys' || v === 'get' || v === 'set' || v === 'unset' || v === 'length') {
                return;
            }

            assert(v in this, 'trying to remove the function "' + v + '", which does not exist in the prototype of this object');
            this.trigger('remove:' + v);
            delete this[v];
            return {};
        },
        updateRemoveObjectState: function (session, added, removed, childpath, v) {
            var ret = {};
            var model = this.get(v);
            assert(model, 'trying to remove a model that does not exist');
            assert('updateState' in model, 'trying to remove an object that does not extend BtappBase');
            model.updateState(session, added, removed, childpath);
            if (model.isEmpty()) {
                ret[v] = model;
                model.trigger('destroy');
            }
            return ret;
        },
        updateRemoveElementState: function (session, added, removed, v, path) {
            var childpath = _.clone(path || []);
            childpath.push(v);
            if (v === 'all') {
                return this.updateState(this.session, added, removed, childpath);
            } else if (_.isNull(removed)) {
                return this.updateRemoveAttributeState(v, removed);
            } else if (_.isObject(removed) && !_.isArray(removed)) {
                return this.updateRemoveObjectState(session, added, removed, childpath, v);
            } else if (_.isString(removed) && RPC.isRPCFunctionSignature(removed)) {
                return this.updateRemoveFunctionState(v);
            } else if (_.isString(removed) && RPC.isJSFunctionSignature(removed)) {
                return this.updateRemoveAttributeState(v, this.rpc.getStoredFunction(removed));
            } else if (v !== 'id') {
                return this.updateRemoveAttributeState(v, removed);
            }
        },
        updateRemoveState: function (session, add, remove, path) {
            var ret = {};
            for (var uv in remove) {
                if (add[uv] === undefined) {
                    _.extend(ret, this.updateRemoveElementState(session, add[uv], remove[uv], uv, path));
                }
            }
            return ret;
        },
        updateAddFunctionState: function (session, added, path, v) {
            //we have a special case for get...we never want the server rpc version
            var childpath = _.clone(path || []);
            childpath.push(v);
            var func = this.rpc.createFunction(session, childpath, added);

            //set the function in the bt object...this is where we store just our rpc client functions
            assert(!(v in this.bt), 'trying to add a function that already exists');
            this.bt[v] = func;

            //also set it on the object directly...this ends up being how people expect to use the objects
            if (v !== 'keys' && v !== 'get' && v !== 'set' && v !== 'unset' && v !== 'length') {
                assert(!(v in this), 'trying to add the function "' + v + '", which already exists in the prototype of this object');
                this[v] = func;
                this.trigger('add:' + v);
            }

            this.trigger('add:bt:' + v);
            this.trigger('add:bt', this.bt[v], v);

            return {};
        },
        updateAddObjectState: function (session, added, removed, childpath, v) {
            var ret = {};
            var model = this.get(v);
            if (model === undefined) {
                // Check if the path matches a valid collection path...if so that is the type that we should create
                var BtappCollection = require('collection.btapp');
                var BtappModel = require('model.btapp');
                if (BtappCollection.prototype.verifyPath(childpath)) {
                    model = new BtappCollection();
                } else {
                    model = new BtappModel({'id': v});
                }
                model.path = childpath;
                model.rpc = this.rpc;

                ret[v] = model;
            }
            model.updateState(this.session, added, removed, childpath);
            return ret;
        },
        updateAddElementState: function (session, added, removed, v, path) {
            var childpath = _.clone(path || []);
            childpath.push(v);

            //make sure we transform the removed variable to the correct js function if
            //removed is the string representation
            if (_.isString(removed) && RPC.isJSFunctionSignature(removed)) {
                removed = this.rpc.getStoredFunction(removed);
            }


            // Special case all. It is a redundant layer that exists for the benefit of the torrent client
            if (v === 'all') {
                return this.updateState(this.session, added, removed, childpath);
            } else if (_.isNull(added)) {
                return this.updateAddAttributeState(session, added, removed, childpath, v);
            } else if (_.isObject(added) && !_.isArray(added)) {
                return this.updateAddObjectState(session, added, removed, childpath, v);
            } else if (_.isString(added) && RPC.isRPCFunctionSignature(added)) {
                return this.updateAddFunctionState(session, added, path, v);
            } else if (_.isString(added) && RPC.isJSFunctionSignature(added)) {
                return this.updateAddAttributeState(session, this.rpc.getStoredFunction(added), removed, path, v);
            } else {
                return this.updateAddAttributeState(session, added, removed, childpath, v);
            }
        },
        updateAddState: function (session, add, remove, path) {
            var ret = {};
            for (var uv in add) {
                _.extend(ret, this.updateAddElementState(session, add[uv], remove[uv], uv, path));
            }
            return ret;
        },
        updateState: function (session, add, remove, path) {
            assert(!isEmptyObject(add) || !isEmptyObject(remove), 'the client is outputing empty objects("' + path + '")...these should have been trimmed off');
            this.session = session;
            if (!this.path) {
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
        sync: function () {
            //no sync for you
        }
    };

    return BtappBase;
});