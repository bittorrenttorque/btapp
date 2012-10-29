// (c) 2012 Kyle Graehl, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

(function() {

    var NUM_PORTS_SCANNED = 5;
    var AJAX_TIMEOUT = 3000;
    
    function assert(b, err) { if(!b) throw err; }

    function getCSS(url) {
        jQuery(document.createElement('link') ).attr({
            href: url,
            type: 'text/css',
            rel: 'stylesheet'
        }).appendTo('head');
    }
    
    function initializeFacebox() {
        jQuery.facebox.settings.overlay = true; // to disable click outside overlay to disable it
        jQuery.facebox.settings.closeImage = 
            'https://torque.bittorrent.com/facebox/src/closelabel.png';
        jQuery.facebox.settings.loadingImage = 
            'https://torque.bittorrent.com/facebox/src/loading.gif';                     
        jQuery.facebox.settings.opacity = 0.6;
    }

    function isMac() {
        return navigator.userAgent.match(/Macintosh/) !== undefined;
    }

    function get_domain(port) {
        return 'http://127.0.0.1:' + port;
    }

    function get_ping_img_url(port) {
        return get_domain(port) + '/gui/pingimg';
    }
    
    function get_dialog_pair_url(port) {
        return get_domain(port) + '/gui/pair?name=' + encodeURIComponent(window.location.host);
    }

    function get_version_url(port) {
        return get_domain(port) + '/version/';
    }

    function get_next_port(port) {
        var next, i = 0;
        do {
            next = get_port(i);
            i += 1;
        } while(next <= port);
        return next;
    }

    function get_port(i) {
        return 7 * Math.pow(i, 3) + 3 * Math.pow(i, 2) + 5 * i + 10000;
    }

    PairingView = Backbone.View.extend({
        initialize: function() {
            assert(this.model.get('pairing_type') !== 'native');
            this.model.on('pairing:authorize', this.authorize_iframe, this);
        },
        authorize_iframe: function(options) {
            //make sure that we've loaded what we need to display
            if(typeof jQuery.facebox === 'undefined') {
                getCSS('https://torque.bittorrent.com/facebox/src/facebox.css');
                jQuery.getScript('https://torque.bittorrent.com/facebox/src/facebox.js', _.bind(this.authorize_iframe, this, options));
                return;
            }

            initializeFacebox();

            var dialog = jQuery('<div></div>');
            dialog.attr('id', 'pairing');
            dialog.css('position', 'absolute');
            dialog.css('height', '200px');
            dialog.css('width', '400px');
            dialog.css('left', '%50');
            dialog.css('margin-left', '-200px');

            var frame = jQuery('<iframe></iframe>');
            var domain = 'https://torque.bittorrent.com';
            var src = domain + '/pairing/index.html' + 
                        '?product=' + this.model.get('product') +
                        '&mime=' + this.model.get('plugin_manager').get('mime_type') +
                        '&name=' + encodeURIComponent(document.title) +
                        '&permissions=download,create,remote';
            frame.attr('src', src);
            frame.css('padding', '0px');
            frame.css('margin', '0px');
            dialog.append(frame);

            jQuery(window).on('message', function(data) {
                //we only want to listen for events that came from us
                if(data.originalEvent.origin === domain) {
                    assert(data && data.originalEvent && data.originalEvent.data, 'no data was passed in the message from the iframe');

                    if(data.originalEvent.data.length === 40) {
                        options.deferred.resolve(data.originalEvent.data);
                    } else if(data.originalEvent.data === 'denied') {
                        options.deferred.reject();
                    } else {
                        throw 'the message data from the iframe was neither a pairing key, nor a denied message';
                    }

                    jQuery(document).trigger('close.facebox');
                    jQuery('#pairing').remove();
                }
            });

            dialog.hide();
            jQuery('body').append(dialog);
            jQuery.facebox({ div: '#pairing' });
        }
    });
    var _plugin_native_pairing_requests = {};
    PluginPairing = {
        check_version: function(port) {
            var ret = new jQuery.Deferred();
            this.trigger('pairing:check_version', {'port': port});
            this.get('plugin_manager').get_plugin().ajax(get_version_url(port), _.bind(function(response) {
                if(!response.allowed || !response.success) {
                    ret.reject();
                } else {
                    var obj;
                    try {
                        ret.resolve(JSON.parse(response.data));
                    } catch(e) {
                        ret.reject();
                        return;
                    }
                }
            }, this));
            return ret;
        },
        authorize_basic: function(port) {
            var deferred;
            if(port in _plugin_native_pairing_requests) {
                deferred = _plugin_native_pairing_requests[port];
                console.log('recycling');
            } else {
                deferred = new jQuery.Deferred();
                _plugin_native_pairing_requests[port] = deferred;
                deferred.done(function() {
                    delete _plugin_native_pairing_requests[port];
                });
                this.get('plugin_manager').get_plugin().ajax(get_dialog_pair_url(port), _.bind(function(response) {
                    if(!response.allowed || !response.success) {
                        deferred.reject();
                    } else {
                        deferred.resolve(response.data);
                    }
                }, this));
            }   

            deferred.then(_.bind(this.authorize_port_success, this, port));
            deferred.fail(_.bind(this.authorize_port_error, this, port));
        }
    };
    var _image_native_pairing_requests = {};
    JQueryPairing = {
        check_version: function(port) {
            this.trigger('pairing:check_version', {'port': port});
            return jQuery.ajax({
                url: get_version_url(port),
                dataType: 'jsonp',
                timeout: AJAX_TIMEOUT
            });
        },
        authorize_basic: function(port) {
            var success = _.bind(this.authorize_port_success, this, port);
            var failure = _.bind(this.authorize_port_error, this, port);
            var promise;
            if(port in _image_native_pairing_requests) {
                promise = _image_native_pairing_requests[port];
                console.log('recycling');
            } else {
                promise = jQuery.ajax({
                    url: get_dialog_pair_url(port),
                    dataType: 'jsonp',
                    timeout: AJAX_TIMEOUT
                });
                _image_native_pairing_requests[port] = promise;
                promise.done(function() {
                    delete _image_native_pairing_requests[port];            
                });
            }
            promise.then(success);
            promise.fail(failure);
        }
    };
    var _plugin_iframe_pairing_requests = {};
    Pairing = Backbone.Model.extend({
        defaults: {
            pairing_type: 'iframe'
        },
        initialize: function() {
            _.bindAll(this, 'on_check_version_success');
            //assert that we know what we're getting into
            assert(this.get('plugin') === false || this.get('plugin_manager'), 'pairing is not intentionally avoiding the plugin, nor is it providing a plugin manager');
            if(this.get('plugin_manager')) {
                _.extend(this, PluginPairing);
            } else {
                _.extend(this, JQueryPairing);
            }
        },
        connect: function() {
            assert(!this.session, 'trying to port scan while one is already in progress');
            var session = {
                abort: false
            };
            var versionchecks = [];
            var complete = _.after(NUM_PORTS_SCANNED, _.bind(function() { 
                if(session.abort === true) return;
                this.disconnect();
                //lets take a peek at versionchecks
                var successes = _.reduce(versionchecks, function(memo, c) {
                    assert(c.state() !== 'pending', 'executing pairing complete functionality while some queries are in flight');
                    var success = c.state() === 'resolved';
                    return memo + (success ? 1 : 0);
                }, 0);
                if(successes === 0) {
                    this.trigger('pairing:stop');
                }
            }, this));
            _.times(NUM_PORTS_SCANNED, function(i) {
                var port = get_port(i);
                var versioncheck = this.check_version(port);
                versioncheck.done(_.bind(function() {
                    if(session.abort) return;
                    this.on_check_version_success.apply(this, arguments);
                }, this, port));
                versionchecks.push(versioncheck);

                versioncheck.always(complete);
            }, this);
            this.session = session;
        },
        disconnect: function() {
            if(this.session) {
                this.session.abort = true;
                this.session = null;
            }
        },
        on_check_version_success: function(port, data) {
            var options = { 
                'version':(typeof data === 'object' ? data.version : 'unknown'),
                'name':(typeof data === 'object' ? data.name : 'unknown'), 
                'port':port,
                'authorize':true
            };
            
            if(data == 'invalid request' || (data && data.version)) {
                this.trigger('pairing:found', options);

                if(options.authorize) {
                    this.authorize(port);
                }
            }
        },
        authorize: function(port) {
            if(this.get('pairing_type') === 'native' || isMac()) {
                //this will use the old school dialogs which allow bittorrent domains to pair automatically
                this.authorize_basic(port);
            } else {
                //if we have the plugin we should check if we're a privileged domain
                var pairing_key = this.get('plugin_manager').get_plugin().pair(this.get('product'));
                if(pairing_key.length === 40) {
                    this.authorize_port_success(port, pairing_key);
                } else {
                    var deferred;
                    if(port in _plugin_iframe_pairing_requests) {
                        deferred = _plugin_iframe_pairing_requests[port];
                        console.log('recycling');
                    } else {
                        deferred = new jQuery.Deferred();
                        _plugin_iframe_pairing_requests[port] = deferred;
                        deferred.done(function() {
                            delete _plugin_iframe_pairing_requests[port];
                        });
                        //let someone build a view to do something with this info
                        this.trigger('pairing:authorize', {
                            'port': port,
                            'deferred': deferred
                        });
                    }

                    deferred.then(_.bind(this.authorize_port_success, this, port));
                    deferred.fail(_.bind(this.authorize_port_error, this, port));
                }
            }
        },
        authorize_port_success: function(port, key) {
            this.trigger('pairing:authorized', {'port':port, 'key':key});
        },
        authorize_port_error: function(port) {
            this.trigger('pairing:denied', port);
        }
    });
}).call(this);