define([
    'jquery',
    'backbone',
    'underscore',
    'base.btapp'
], function (jQuery, Backbone, _, BtappBase) {
    'use strict';

    // some of us are lost in the world without __asm int 3;
    // lets give ourselves an easy way to blow the world up if we're not happy about something
    var assert = function (b, err) { if (!b) { throw err; } };

    var isEmptyObject = function (obj) {
        return _.isObject(obj) && !_.isArray(obj) &&  jQuery.isEmptyObject(obj);
    };

    // BtappModel
    // -------------

    // BtappModel is the base model for most things in the client
    // a torrent is a BtappModel, a file is a BtappModel, properties that
    // hang off of most BtappModels is also a BtappModel...both BtappModel
    // and BtappCollection objects are responsible for taking the json object
    // that is returned by the client and turning that into attributes/functions/etc
    var BtappModel = Backbone.Model.extend(BtappBase).extend({
        initialize: function () {
            Backbone.Model.prototype.initialize.apply(this, arguments);
            BtappBase.initialize.apply(this, arguments);

            this.on('change', this.customEvents, this);
        },
        destructor: function () {
            this.off('change', this.customEvents, this);
            this.trigger('destroy');
        },
        clearState: function () {
            this.initializeValues();
            var clone = _.clone(this.attributes);
            delete clone.id;
            _.each(clone, function (attribute) {
                if (attribute && _.isObject(attribute) && attribute.hasOwnProperty('clearState')) {
                    attribute.clearState();
                }
            });
            Backbone.Model.prototype.set.call(this, clone, {internal: true, unset: true});
            this.destructor();
        },
        customEvents: function () {
            var attributes = this.changedAttributes();
            _.each(attributes, _.bind(function (value, key) {
                //check if this is a value that has been unset
                if (value === undefined) {
                    var prev = this.previous(key);
                    this.trigger('remove', prev, key);
                    this.trigger('remove:' + key, prev);
                } else if (this.previous(key) === undefined) {
                    this.trigger('add', value, key);
                    this.trigger('add:' + key, value);
                }
            }, this));
        },
        verifyPath: function () {
            return true;
        },
        updateRemoveAttributeState: function (v, removed) {
            var ret = {};
            assert(this.get(v) === removed, 'trying to remove an attribute, but did not provide the correct previous value');
            ret[v] = this.get(v);
            return ret;
        },
        updateAddAttributeState: function (session, added, removed, childpath, v) {
            var ret = {};
            // Set non function/object variables as model attributes
            assert(this.get(v) !== added, 'trying to set a variable to the existing value [' + childpath + ' -> ' + JSON.stringify(added) + ']');
            if (removed !== undefined) {
                assert(this.get(v) === removed, 'trying to update an attribute, but did not provide the correct previous value');
            }
            ret[v] = added;
            return ret;
        },
        isEmpty: function () {
            var keys = _.keys(this.toJSON());
            return isEmptyObject(this.bt) && (keys.length === 0 || (keys.length === 1 && keys[0] === 'id'));
        },
        applyStateChanges: function (add, remove) {
            Backbone.Model.prototype.set.call(this, add, {internal: true});
            Backbone.Model.prototype.set.call(this, remove, {internal: true, unset: true});
        },
        set: function (key, value, options) {
            var evaluate = function (value, key) {
                if (options && 'internal' in options) {
                    return;
                }
                if (_.isUndefined(this.get(key))) {
                    return;
                }
                // We're trying to guide users towards using save
                throw 'please use save to set attributes directly to the client';
            };

            // This code is basically right out of the Backbone.Model set code.
            // Have to handle a variety of function signatures
            if (_.isObject(key) || key === null) {
                _(key).each(evaluate, this);
            } else {
                evaluate.call(this, value, key);
            }

            return Backbone.Model.prototype.set.apply(this, arguments);
        },
        save: function (attributes) {
            var deferreds = [];
            _(attributes).each(function (value, key) {
                deferreds.push(this.bt.set(key, value));
            }, this);
            return jQuery.when.apply(jQuery, deferreds);
        }
    });

    return BtappModel;
});