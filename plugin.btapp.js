// (c) 2012 Kyle Graehl / Patrick Williams, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

window.BtappPluginManager = Backbone.Model.extend({
    //Avoid DOM collisions by having a ridiculous id.
    BTAPP_PLUGIN_ID: 'btapp_plugin_1982391823981239812389',
    //All BitTorrent products have this number appended to their window names
    BT_WINDOW_HASH: '4823',
    PRODUCT:'Torque',
    MIME_TYPE: 'application/x-btlauncher',

    loading: false,
    loaded: false,
    visible: false,
    downloading_product: false,
    launched_time: null,
    initialize: function(attributes) {
        _.bindAll(this, 
            'plugin',
            'add_plugin', 
            'remove_plugin', 
            'plugin_installed',
            
            'torque_install_callback',
            'torque_running',
            
            'load_dialog_dependencies',
            'show_install_plugin_dialog',
            'hide_install_plugin_dialog',
            'install_plugin_dialog_visible',
            
            'ensure_torque_running',
            'ensure_plugin_installed',
            'ensure_plugin_and_product_available'
        );
        _.defer(this.ensure_plugin_and_product_available);
    },
    
    
    
    // Plugin Specific Functionality
    // ---------------------------
    plugin: function() {
        return document.getElementById(BTAPP_PLUGIN_ID);
    },
    // Add the plugin object to the DOM. This doesn't necessarily mean that 
    // we'll have the functionality. We'll need to check the elements properties
    // to determine if the browser supports our mime type...if only IE supported
    // listing the mime types the browser supports
    add_plugin: function(cb) {
        assert(jQuery('#' + BTAPP_PLUGIN_ID).length == 0);
        var obj = document.createElement('object');
        var onload = BTAPP_PLUGIN_ID + 'onload';
        window[onload] = _.once(function() {
            cb();
        });
        var div = document.createElement('div');			
        jQuery(div).css({'position':'absolute','left':'-999em'});
        div.innerHTML = 
            '<object id="' + BTAPP_PLUGIN_ID + '" type="' + MIME_TYPE + '" width="0" height="0">' + 
                '<param name="onload" value="' + onload + '" />' + 
            '</object>';
            
        document.body.appendChild(div);
        setTimeout(window[onload], 1000);
    },
    // Just blow the DOM element away...it probably means that we discovered 
    // that the mime type wasn't supported and we need to install the plugin.
    remove_plugin: function() {
        jQuery('#btapp_plugin').remove();
    },
    // This is a pretty messy way to determine if we have the plugin installed.
    // Hope this doesn't have a race condition in it.
    plugin_installed: function() {
        if (!this.plugin()) {
            this.add_plugin();
        }
        var exists = (this.plugin().version);
        this.remove_plugin();
        return exists;
    },
    
    
    
    // Torque Specific Functionality
    // ---------------------------
    // This is called when the plugin has downloaded and run the torque client.
    torque_install_callback: function(a,b,c,d) {
        this.trigger('plugin:torque_installed');
        this.downloading_product = false;
        this.launched_time = new Date(); 
        // don't try to re-launch or re-download for a while... 
        //(race condition, it doesn't show up in isRunning for a little while, but we want to be able to detect it right away
        setTimeout(this.ensure_plugin_and_product_available, 1000);
    },
    // Lets ask the plugin if the specific client is running.
    torque_running: function() {
        var plugin = this.plugin();
        var clients = plugin.isRunning(PRODUCT + BT_WINDOW_HASH);
        var running = clients && clients.length > 0;
        return running;
    },
    
    

    // DIALOG SPECIFIC FUNCTIONALITY
    // ---------------------------
    // We didn't want to burdon the browser with loading in all the facebox code
    // if we didn't need it...well here we are. 
    load_dialog_dependencies: function(callback) {
        this.loading = true;
        var css_link = 'http://apps.bittorrent.com/torque/facebox/src/facebox.css';
        var head = jQuery('head');
        head.append('<link rel="stylesheet" type="text/css" href="' + css_link + '" />');
        jQuery.getScript('http://apps.bittorrent.com/torque/facebox/src/facebox.js',
            _.bind(function(data, textStatus) {
                this.loaded = true;
                jQuery.facebox.settings.overlay = true; // to disable click outside overlay to disable it
                jQuery.facebox.settings.closeImage = 'http://apps.bittorrent.com/torque/facebox/src/closelabel.png';
                jQuery.facebox.settings.loadingImage = 'http://apps.bittorrent.com/torque/facebox/src/loading.gif';						
                jQuery.facebox.settings.opacity = 0.6;
                callback();
            }, this)
        );
    },
    // Its show time! Lets get this baby installed.
    show_install_plugin_dialog: function() {
        this.trigger('plugin:show_install_plugin_dialog');
        assert(!this.visible);
        var dialog = jQuery('<div></div>');
        dialog.attr('id', 'install');
        
        var paragraph = jQuery('<p></p>');
        paragraph.text('This site requires the BitTorrent Torque plugin.');
        dialog.append(paragraph);
        
        var button = jQuery('<a id="download" href="http://apps.bittorrent.com/torque/btlauncher.msi">Download</a>');
        button.click(_.bind(this.trigger, this, 'downloading_plugin'));
        dialog.append(button);
        dialog.hide();
        jQuery('body').append(dialog);
        jQuery.facebox({ div: '#install' });
        this.visible = true;
    },
    // Uh oh...this could happen for a million reasons.
    hide_install_plugin_dialog: function() {
        assert(this.visible);
        jQuery(document).trigger('close.facebox');
        this.visible = false;
        this.trigger('plugin:hide_install_plugin_dialog');
    },
    // Is the user pondering whether to install?
    install_plugin_dialog_visible: function() {
        return this.visible;
    },

    
    
    // The Controller Logic
    // ---------------------------
    // What to download, what to install, what dialogs to show
    ensure_torque_running: function() {
        if(this.install_plugin_dialog_visible()) {
            this.hide_install_plugin_dialog();
        }
        if (this.torque_running()) {
            this.trigger('plugin:torque_running');
            this.launched_time = null;
            // Torque is running. OK! Lets check back again in 10 secs, in case torque crashes or something
            setTimeout(this.ensure_plugin_and_product_available, 10000);
        } else if (!this.downloading_product) {
            if (this.launched_time && new Date() - this.launched_time < 10000) {
                // Allow launch 10 seconds until the process shows up.
                return;
            }
            var version = '';
            var switches = {'install':true};
            this.trigger('plugin:install_torque', switches);
            if(switches.install) {
                this.downloading_product = true;
                this.plugin().downloadProgram(PRODUCT, version, this.torque_install_callback);
            }
        }
    },
    // We don't have the plugin and the app that's loaded this file hasn't opted out     // of the install path. Lets offer it up to the user.
    ensure_plugin_installed: function() {
        if(!this.install_plugin_dialog_visible()) {
            if(this.loaded) {
                this.show_install_plugin_dialog();
            } else if(!this.loading) {
                this.load_dialog_dependencies(this.show_install_plugin_dialog);
            }
        }
        this.remove_plugin();
        setTimeout(this.ensure_plugin_and_product_available, 1000);
    },
    // This is the main entry point to this file. We want to install both the plugin and torque and make sure torque is running.
    ensure_plugin_and_product_available: function() {
        // If we haven't added the plugin object tag, add it then check back when its loaded
        if(!this.plugin()) { 
            this.add_plugin(this.ensure_plugin_and_product_available);
            return;
        } 
        
        // We use the version property to determine if the plugin has been loaded (indicating mime type support).
        var plugin_installed = this.plugin().version;
        if(plugin_installed) {
            this.trigger('plugin:plugin_running');
            this.ensure_torque_running();
        } else {
            var switches = {'install':true};
            this.trigger('plugin:install_plugin', switches);
            if(switches.install) {
                this.ensure_plugin_installed();
            }
        }
    }	
});
