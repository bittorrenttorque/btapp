// (c) 2012 Kyle Graehl, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

(function() {

    var MAX_PORT = 11000;
    
    function assert(b, err) { if(!b) throw err; }

    function getCSS(url) {
        jQuery(document.createElement('link') ).attr({
            href: url,
            type: 'text/css',
            rel: 'stylesheet'
        }).appendTo('head');
    }
    
    function isMac() {
        return navigator.userAgent.match(/Macintosh/) != undefined;
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
            assert(this.model.get('plugin_manager').get_plugin());
            this.model.on('pairing:authorize', this.authorize_iframe, this);
        },
        authorize_iframe: function(options) {
            //make sure that we've loaded what we need to display
            if(typeof jQuery.fn.modal === 'undefined') {
                getCSS('https://torque.bittorrent.com/pairing/stylesheets/bootstrap-modal.css');
                jQuery.getScript('https://torque.bittorrent.com/pairing/javascripts/bootstrap-modal.js', _.bind(this.authorize_iframe, this, options));
                return;
            }

            var domain = 'https://torque.bittorrent.com';
            var src = domain + '/pairing/index.html'
                        + '?product=' + this.model.get('product')
                        + '&mime=' + this.model.get('plugin_manager').get('mime_type')
                        + '&name=' + document.title 
                        + '&permissions=download,create,remote';

            var modal = $(' <div class="modal hide" id="permission_container">\
                                <div class="modal-header"></div>\
                                <iframe\
                                    style="width: 100%; height: auto;"\
                                    id="permission"\
                                    frameborder=0\
                                    src="' + src + '"></iframe>\
                                <div class="modal-footer"></div>\
                            </div>'
            );
            modal.modal({
                backdrop: 'static',
                keyboard: false
            });

            jQuery(window).on('message', function(data) {
                //we only want to listen for events that came from us
                if(data.originalEvent.origin === domain) {
                    options.callback(options.port, data);
                    modal.modal('hide');
                }
            });
        }
    });

    PluginPairing = {
        ping_port: function(port) {
            //the plugin doesn't support binary data, which is what the image url returns...
            //so lets just skip straight to the version query
            this.on_ping_success(port);
        },
        check_version: function(port) {
            this.trigger('pairing:check_version', {'port': port});
            this.get('plugin_manager').get_plugin().ajax(get_version_url(port), _.bind(function(response) {
                if(!response.allowed || !response.success) {
                    this.on_check_version_error(port);
                } else {
                    var obj;
                    try {
                        obj = JSON.parse(response.data);
                    } catch(e) {
                        this.on_check_version_error(port);
                        return;
                    }
                    this.on_check_version_success(port, obj); 
                }
            }, this));
        },
        authorize_basic: function(port) {
            this.get('plugin_manager').get_plugin().ajax(get_dialog_pair_url(port), _.bind(function(response) {
                if(!response.allowed || !response.success) {
                    this.authorize_port_error(port);
                } else {
                    this.authorize_port_success(port, response.data);
                }
            }, this));
        }
    };

    ImagePairing = {
        ping_port: function(port) {
            var img = new Image();
            img.onerror = _.bind(this.on_ping_error, this, port);
            img.onload = _.bind(this.on_ping_success, this, port);
            img.src = get_ping_img_url(port);
        },
        check_version: function(port) {
            this.trigger('pairing:check_version', {'port': port});
            jQuery.ajax({
                url: get_version_url(port),
                dataType: 'jsonp',
                success: _.bind(this.on_check_version_success, this, port),
                error: this.on_check_version_error
            });
        },
        authorize_basic: function(port) {
            jQuery.ajax({
                url: get_dialog_pair_url(port),
                dataType: 'jsonp',
                success: _.bind(this.authorize_port_success, this, port),
                error: _.bind(this.authorize_port_error, this, port)
            });
        }
    };

    Pairing = Backbone.Model.extend({
        defaults: {
            pairing_type: 'iframe'
        },
        initialize: function() {
            _.bindAll(this, 'on_ping_error', 'on_ping_success', 'on_check_version_error', 'on_check_version_success', 'authorize_port_callback');
            if(this.get('plugin_manager')) {
                _.extend(this, PluginPairing);
            } else {
                _.extend(this, ImagePairing);
            }
        },
        scan: function() {
            this.ping(get_port(0));
        },
        ping: function(port) {
            if(port > MAX_PORT) {
                this.trigger('pairing:stop', {'reason': 'max port reached'});
                return;
            }

            this.trigger('pairing:attempt', {'port': port});
            this.ping_port(port);
        },
        on_ping_error: function(port) {
            this.ping(get_next_port(port));
        },
        on_ping_success: function(port) {
            this.check_version(port);
        },
        on_check_version_error: function(port, data) {
            this.ping(get_next_port(port));
        },
        on_check_version_success: function(port, data) {
            var options = { 
                'version':(typeof data === 'object' ? data.version : 'unknown'),
                'name':(typeof data === 'object' ? data.name : 'unknown'), 
                'port':port,
                'authorize':true,
                'abort':false
            };
            
            if(data == 'invalid request' || (data && data.version)) {
                this.trigger('pairing:found', options);

                if(options.authorize) {
                    this.authorize(port);
                }

                if(!options.abort) {
                    this.ping(get_next_port(port));
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
                    //let someone build a view to do something with this info
                    this.trigger('pairing:authorize', {
                        'port': port,
                        'callback': this.authorize_port_callback
                    });
                }
            }
        },
        authorize_port_success: function(port, key) {
            this.trigger('pairing:authorized', {'port':port, 'key':key});
        },
        authorize_port_error: function(port) {
            this.trigger('pairing:denied', port);
        },
        authorize_port_callback: function(port, data) {
            assert(data && data.originalEvent && data.originalEvent.data, 'no data was passed in the message from the iframe');

            if(data.originalEvent.data.length === 40) {
                this.authorize_port_success(port, data.originalEvent.data);
            } else if(data.originalEvent.data === 'denied') {
                this.authorize_port_error(port);
            } else {
                throw 'the message data from the iframe was neither a pairing key, nor a denied message';
            }
        }
    });
}).call(this);