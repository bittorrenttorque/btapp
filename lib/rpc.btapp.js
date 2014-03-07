define([
    'jquery',
    'underscore'
], function (jQuery, _) {
    'use strict';
    var assert = function (b, err) { if (!b) { throw err; } };

    // RPC
    // -------------

    var RPC = function (attributes) {
        this.port = attributes.port;
        this.callbacks = {};
    };

    // We can't send function pointers to the torrent client server, so we'll send
    // the name of the callback, and the server can call this by sending an event with
    // the name and args back to us. We're responsible for making the call to the function
    // when we detect this. This is the same way that jquery handles ajax callbacks.
    RPC.prototype.storeCallbackFunction = function (cb) {
        cb = cb || function () {};
        var str = 'bt_';
        for (var i = 0; i < 20 || (str in this.callbacks); i++) { str += Math.floor(Math.random() * 10); }
        this.callbacks[str] = cb;
        return str;
    };
    // We expect function signatures that come from the client to have a specific syntax
    RPC.isRPCFunctionSignature = function (f) {
        assert(typeof f === 'string', 'do not check function signature of non-strings');
        return f.match(/\[native function\](\([^\)]*\))+/) ||
                f.match(/\[nf\](\([^\)]*\))+/);
    };
    RPC.isJSFunctionSignature = function (f) {
        assert(typeof f === 'string', 'do not check function signature of non-strings');
        return f.match(/\[nf\]bt_/);
    };
    RPC.prototype.getStoredFunction = function (f) {
        assert(RPC.isJSFunctionSignature(f), 'only store functions that match the pattern "[nf]bt_*"');
        var key = f.substring(4);
        assert(key in this.callbacks, 'trying to get a function with a key that is not recognized');
        return this.callbacks[key];
    };
    // Seeing as we're interfacing with a strongly typed language c/c++ we need to
    // ensure that our types are at least close enough to coherse into the desired types
    // takes something along the lines of "[native function](string,unknown)(string)".
    RPC.validateArguments = function (functionValue, variables) {
        assert(typeof functionValue === 'string', 'expected functionValue to be a string');
        assert(typeof variables === 'object', 'expected variables to be an object');
        var signatures = functionValue.match(/\([^\)]*\)/g);
        return _.any(signatures, function (signature) {
            signature = signature.match(/\w+/g) || []; //["string","unknown"]
            return signature.length === variables.length && _.all(signature, function (type, index) {
                if (typeof variables[index] === 'undefined') {
                    throw 'client functions do not support undefined arguments';
                } else if (variables[index] === null) {
                    return true;
                }

                switch (type) {
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
                default:
                    //has the client provided a type that we weren't expecting?
                    throw 'there is an invalid type in the function signature exposed by the client';
                }
            });
        });
    };
    RPC.prototype.convertCallbackFunctionArgs = function (args) {
        _.each(args, function (value, key) {
            // We are responsible for converting functions to variable names...
            // this will be called later via a event with a callback and arguments variables
            if (typeof value === 'function') {
                args[key] = this.storeCallbackFunction(value);
            } else if (typeof value === 'object' && value) {
                this.convertCallbackFunctionArgs(value);
            }
        }, this);
    };
    // Functions are simply urls that we make ajax request to. The cb is called with the
    // result of that ajax request.
    RPC.prototype.createFunction = function (session, path, signatures) {
        assert(session, 'cannot create a function without a session id');
        var func = _.bind(function () {
            var args = [];

            // Lets do a bit of validation of the arguments that we're passing into the client
            // unfortunately arguments isn't a completely authetic javascript array, so we'll have
            // to "splice" by hand. All this just to validate the correct types! sheesh...
            var i;
            for (i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }
            // This is as close to a static class function as you can get in javascript i guess
            // we should be able to use verifySignaturesArguments to determine if the client will
            // consider the arguments that we're passing to be valid
            assert(RPC.validateArguments.call(this, signatures, args), 'arguments do not match any of the function signatures exposed by the client');

            this.convertCallbackFunctionArgs(args);
            var ret = new jQuery.Deferred();
            var success = _.bind(function (data) {
                //lets strip down to the relevent path data
                _.each(path, function (segment) {
                    var decoded = decodeURIComponent(segment);
                    if (typeof data !== 'undefined') {
                        data = data[decoded];
                    }
                });
                if (typeof data === 'undefined') {
                    ret.reject('return value parsing error ' + JSON.stringify(data));
                } else if (typeof data === 'string' && RPC.isJSFunctionSignature(data)) {
                    var func = this.getStoredFunction(data);
                    assert(func, 'the client is returning a function name that does not exist');
                    ret.resolve(func);
                } else {
                    ret.resolve(data);
                }
            }, this);
            var error = function (data) {
                ret.reject(data);
            };
            this.query({
                type: 'function',
                path: JSON.stringify(path),
                args: JSON.stringify(args),
                session: session
            }).done(success).fail(error);
            return ret;
        }, this);
        func.valueOf = function () { return signatures; };
        return func;
    };
    RPC.prototype.query = function (args) {
        var abort = false;
        var ret = new jQuery.Deferred();
        assert(args.type === 'update' || args.type === 'state' || args.type === 'function' || args.type === 'disconnect', 'the query type must be either "update", "state", or "function"');

        args.hostname = window.location.hostname || window.location.pathname;
        var onSuccess = _.bind(function (data) {
            if (data === 'invalid request') {
                throw 'pairing occured with a torrent client that does not support the btapp api';
            } else if (typeof data !== 'object' || 'error' in data) {
                ret.reject();
            } else {
                ret.resolve(data);
            }
        }, this);
        this.sendQuery(args)
            .done(function () {
                if (!abort) {
                    onSuccess.apply(this, arguments);
                }
            }).fail(function () {
                if (!abort) {
                    ret.reject.apply(this, arguments);
                }
            });
        ret.abort = function () {
            abort = true;
        };
        return ret;
    };
    RPC.prototype.sendQuery = function (data) {
        var url = 'http://localhost.bittorrent.com:' + this.port + '/btapp/';
        return this.ajax({
            url: url,
            data: data,
            dataType: 'jsonp'
        });
    };
    
    return RPC;
});