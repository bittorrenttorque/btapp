// (c) 2012 Kyle Graehl / Patrick Williams, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

(function() {

    function assert(b, err) { if(!b) throw err; }

    //utility function to wait for some condition
    //this ends up being helpful as we toggle between a flow chart and a state diagram
    function when(condition, functionality, interval) {
        var when_func = function() {
            if(condition.call()) {
                functionality.call();
            } else {
                setTimeout(when_func, interval || 500);
            }
        };
        _.defer(when_func);
    }

    function getCSS(url) {
        jQuery(document.createElement('link') ).attr({
            href: url,
            type: 'text/css',
            rel: 'stylesheet'
        }).appendTo('head');
    }
    
    function initializeFacebox() {
        jQuery.facebox.settings.overlay = true; // to disable click outside overlay to disable it
        jQuery.facebox.settings.closeImage = 'http://apps.bittorrent.com/torque/facebox/src/closelabel.png';
        jQuery.facebox.settings.loadingImage = 'http://apps.bittorrent.com/torque/facebox/src/loading.gif';                     
        jQuery.facebox.settings.opacity = 0.6;
    }

    PluginManagerView = Backbone.View.extend({
        defaults: {
            plugin_install_message: 'This site requires the BitTorrent Torque plugin.',
            facebox_base_url: 'http://apps.bittorrent.com/torque/facebox/',
            windows_download_url: 'http://apps.bittorrent.com/torque/SoShare.msi',
            osx_download_url: undefined
        },
        initialize: function(options) {
            _.bindAll(this, 'download');

            this.plugin_install_message = options.plugin_install_message || this.defaults.plugin_install_message;
            this.facebox_base_url = options.facebox_base_url || this.defaults.facebox_base_url;
            this.windows_download_url = options.windows_download_url || this.defaults.windows_download_url;
            this.osx_download_url = options.osx_download_url || this.defaults.osx_download_url;

            this.model.bind('plugin:install_plugin', this.download);
        },
        download: function(options) {
            options.install = true;

            //make sure that we've loaded what we need to display
            if(typeof jQuery.facebox === 'undefined') {
                getCSS(this.facebox_base_url + 'src/facebox.css');
                jQuery.getScript(
                    this.facebox_base_url + 'src/facebox.js', 
                    _.bind(this.download, this, options)
                );
                return;
            }

            initializeFacebox();

            var dialog = jQuery('<div></div>');
            dialog.attr('id', 'plugin_download');
            dialog.css('position', 'absolute');
            dialog.css('height', '200px');
            dialog.css('width', '400px');
            dialog.css('left', '%50');
            dialog.css('margin-left', '-200px');

            var paragraph = jQuery('<p></p>');
            paragraph.text(this.plugin_install_message);
            dialog.append(paragraph);

            var button_url = (jQuery.client.os === 'Windows') ? this.osx_download_url : this.windows_download_url;
            var button = jQuery('<a id="download" href="' + button_url + '">Download</a>');
            dialog.append(button);

            this.model.bind('plugin:plugin_installed', function() {
                jQuery(document).trigger('close.facebox');
                jQuery('#plugin_download').remove();
            });

            dialog.hide();
            jQuery('body').append(dialog);
            jQuery.facebox({ div: '#plugin_download' });
        }
    });

    PluginManager = Backbone.Model.extend({
        defaults: {
            //Avoid DOM collisions by having a ridiculous id.
            pid: 'btapp_plugin_WARNING_HAVE_NOT_INITIALIZED',
            //All BitTorrent products have this number appended to their window names
            window_hash: '4823',
            product:'SoShare',
            mime_type: 'application/x-gyre-soshare',
            activex_progid: 'gyre.soshare',
        },
        initialize: function() {
            _.bindAll(this);
            this.set('pid', 'btapp_plugin_' + Math.floor(Math.random() * 1024));
            //when we load jquery, we should defer a call to mime_type_check
            jQuery(_.bind(_.defer, this, this.mime_type_check));
        },

        //we know nothing. we want:
        //the plugin installed
        //the plugin up to date
        //the client installed
        //the client running
        mime_type_check: function() {
            if(this.supports_mime_type()) {
                this.mime_type_check_yes();
            } else {
                this.mime_type_check_no();
            }
        },
        mime_type_check_no: function() {
            var switches = {'install':false};
            this.trigger('plugin:install_plugin', switches);
            if(switches.install) {
                when(this.supports_mime_type, this.mime_type_check_yes);
            }
        },
        mime_type_check_yes: function() {
            this.trigger('plugin:plugin_installed');
            this.add_plugin(_.bind(function() {
                this.trigger('plugin:plugin_running');
                this.plugin_up_to_date_check();
            }, this));
        },

        plugin_up_to_date_check: function() {
            if(this.plugin_up_to_date()) {
                this.plugin_up_to_date_yes();
            } else {
                this.plugin_up_to_date_no();
            }
        },
        plugin_up_to_date_yes: function() {
            this.client_installed_check();
        },
        plugin_up_to_date_no: function() {
            var switches = {'update':true};
            this.trigger('plugin:update_plugin', switches);
            if(switches.update) {
                when(this.plugin_up_to_date, this.plugin_up_to_date_yes);
            } else {
                this.plugin_up_to_date_yes();
            }
        },

        //the plugin is installed. good.
        client_installed_check: function() {
            if(this.client_installed()) {
                this.client_installed_check_yes();
            } else {
                this.client_installed_check_no();
            }
        },
        client_installed_check_no: function() {
            var switches = {'install':true};
            this.trigger('plugin:install_client', switches);
            if(switches.install) {
                this.get_plugin().downloadProgram(this.get('product'), _.bind(function(a,b,c,d,key) {
                    jQuery.jStorage.set('pairing_key', key);
                    this.trigger('plugin:downloaded_client');
                }, this));
                when(this.client_installed, this.client_running_check_yes);
            }
        },
        client_installed_check_yes: function() {
            this.trigger('plugin:client_installed');
            this.client_running_check();
        },

        //the client is installed. good. 
        client_running_check: function() {
            if(this.client_running()) {
                this.client_running_check_yes();
            } else {
                this.client_running_check_no();
            }
        },
        client_running_check_no: function() {
            this.get_plugin().runProgram(this.get('product'), function() {});
            when(this.client_running, this.client_running_check_yes);
        },
        client_running_check_yes: function() {
            //well i'll be...looks like we made it to the end.
            this.trigger('plugin:client_running');
        },


        // Plugin Specific Functionality
        // ---------------------------
        supports_mime_type: function() {
            var isIE  = (navigator.appVersion.indexOf('MSIE') != -1) ? true : false;
            if(isIE) {
                try {
                    var tq = new ActiveXObject(this.get('activex_progid'));
                    return tq !== undefined;
                } catch (e) {
                    return false;
                }
            } else {
                navigator.plugins.refresh();
                for (var i = 0; i < navigator.plugins.length; i++) {
                    var plugin = navigator.plugins[i][0];
                    if (plugin.type == this.get('mime_type')) {
                        return true;
                    }
                }
                return false;
            }
        },
        plugin_up_to_date: function() {
            return true;
        },
        get_plugin: function() {
            var ret = document.getElementById(this.get('pid'));
            assert(ret, 'cannot call get_plugin before adding the plugin');
            return ret;
        },
        plugin_loaded: function() {
            assert(this.supports_mime_type(), 'you have not installed the plugin yet')
            assert(jQuery('#' + this.get('pid')).length !== 0, 'you have not yet added the plugin');
            return get_plugin().version;
        },
        add_plugin: function(cb) {
            assert(this.supports_mime_type(), 'you have not installed the plugin yet')
            assert(jQuery('#' + this.get('pid')).length === 0);
            var obj = document.createElement('object');
            var onload = this.get('pid') + 'onload';
            window[onload] = cb;
            var div = document.createElement('div');            
            jQuery(div).css({'position':'absolute','left':'-999em'});
            div.innerHTML =
                '<object id="' + this.get('pid') + '" type="' + this.get('mime_type') + '" width="0" height="0">' +
                    '<param name="onload" value="' + onload + '" />' +
                '</object>';

            document.body.appendChild(div);
        },  
        remove_plugin: function() {
            jQuery('#btapp_plugin').remove();
        },



        // Client Specific Functionality
        // ---------------------------
        // Lets ask the plugin if the specific client is running.
        client_running: function() {
            var clients = this.get_plugin().isRunning(this.get('product') + this.get('window_hash'));
            var running = clients && clients.length > 0;
            return running;
        },
        client_installed: function() {
            var version = this.get_plugin().getInstallVersion(this.get('product'));
            var not_supported = 'This application is not supported.';
            assert(version !== not_supported, not_supported);
            return version;
        }
    });
}).call(this);