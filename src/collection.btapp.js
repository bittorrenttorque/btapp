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

    // BtappCollection
    // -------------

    // BtappCollection is a collection of objects in the client...
    // currently this can only be used to represent the list of torrents,
    // then within the torrents, their list of files...this will eventually
    // be used for rss feeds, etc as well.
    var BtappCollection = Backbone.Collection.extend(BtappBase).extend({
        initialize: function () {
            Backbone.Collection.prototype.initialize.apply(this, arguments);
            BtappBase.initialize.apply(this, arguments);

            this.on('add', this.customAddEvent, this);
            this.on('remove', this.customRemoveEvent, this);
            this.on('change', this.customChangeEvent, this);
        },
        customEvent: function (event, model) {
            //we want to ignore our internal add/remove events for our client rpc functions
            if (_.isFunction(model)) {
                return;
            }

            assert(model && model.id, 'called a custom ' + event + ' event without a valid attribute');
            this.trigger(event + ':' + model.id, model);
        },
        customAddEvent: function (model) {
            this.customEvent('add', model);
        },
        customRemoveEvent: function (model) {
            this.customEvent('remove', model);
        },
        customChangeEvent: function (model) {
            this.customEvent('change', model);
        },
        destructor: function () {
            this.off('add', this.customAddEvent, this);
            this.off('remove', this.customRemoveEvent, this);
            this.off('change', this.customChangeEvent, this);
            this.trigger('destroy');
        },
        clearState: function () {
            this.each(function (model) { model.clearState(); });
            this.initializeValues();
            this.reset();
            this.destructor();
        },
        verifyPath: function (path) {
            var collections = [
                ['btapp', 'torrent'],
                ['btapp', 'torrent', 'all', '*', 'file'],
                ['btapp', 'torrent', 'all', '*', 'peer'],
                ['btapp', 'label'],
                ['btapp', 'label', 'all', '*', 'torrent'],
                ['btapp', 'label', 'all', '*', 'torrent', 'all', '*', 'file'],
                ['btapp', 'label', 'all', '*', 'torrent', 'all', '*', 'peer'],
                ['btapp', 'rss'],
                ['btapp', 'rss', 'all', '*', 'item'],
                ['btapp', 'stream'],
                ['btapp', 'stream', 'all', '*', 'diskio']
            ];

            return _.any(collections, function (collection) {
                if (collection.length !== path.length) {
                    return false;
                }
                for (var i = 0; i < collection.length; i++) {
                    if (collection[i] === '*') {
                        continue;
                    }
                    if (collection[i] !== path[i]) {
                        return false;
                    }
                }
                return true;
            });
        },
        updateRemoveAttributeState: function () {
            throw 'trying to remove an invalid type from a BtappCollection';
        },
        updateAddAttributeState: function () {
            throw 'trying to add an invalid type to a BtappCollection';
        },
        isEmpty: function () {
            return isEmptyObject(this.bt) && this.length === 0;
        },
        applyStateChanges: function (add, remove) {
            this.add(_.values(add));
            this.remove(_.values(remove));
        }
    });

    return BtappCollection;
});