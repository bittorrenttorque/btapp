// (c) 2012 Kyle Graehl, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

(function() {

	function assert(b, err) { if(!b) throw err; }

	function getCSS(url) {
	    jQuery(document.createElement('link') ).attr({
	        href: url,
	        type: 'text/css',
	        rel: 'stylesheet'
	    }).appendTo('head');
	};
	
	function initializeFacebox() {
		jQuery.facebox.settings.overlay = true; // to disable click outside overlay to disable it
		jQuery.facebox.settings.closeImage = 'http://apps.bittorrent.com/torque/facebox/src/closelabel.png';
		jQuery.facebox.settings.loadingImage = 'http://apps.bittorrent.com/torque/facebox/src/loading.gif';						
		jQuery.facebox.settings.opacity = 0.6;
	}

	function get_domain() {
		return 'http://127.0.0.1';
	}

	function authorized_domain() {
		return location.host.match(/([^.]+)\.utorrent.com/i) ||
			location.host.match(/([^.]+)\.bittorrent.com/i) ||
			location.host.match(/([^.]+)\.getshareapp.com/i);
	}

	function get_ping_img_url(port) {
		return get_domain() + ':' + port + '/gui/pingimg';
	}
	
	function get_iframe_pair_url(port) {
		return get_domain() + ':' + port + '/gui/pair?iframe=' + encodeURIComponent(window.location.origin);
	}
	
	function get_dialog_pair_url(port) {
		return get_domain() + ':' + port + '/gui/pair?name=' + encodeURIComponent(window.location.origin);
	}

	function get_version_url(port) {
		return get_domain() + ':' + port + '/version/';
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

	var MAX_PORT = 11000;

	Pairing = Backbone.Model.extend({
		scan: function() {
			this.ping(get_port(0));
		},
		ping: function(port) {
			if(port > MAX_PORT) {
				this.trigger('pairing:stop', {'reason': 'max port reached'});
				return;
			}

			this.trigger('pairing:attempt', {'port': port});
			var img = new Image();
			img.onerror = _.bind(this.ping, this, get_next_port(port));
			img.onload = _.bind(this.port_found, this, port);
			img.src = get_ping_img_url(port);
		},
		port_found: function(port) {
			jQuery.ajax({
				url: get_version_url(port),
				dataType: 'jsonp',
				context: this,
				success: function(data, status, xhr) {
					var options = { 
						'version':(typeof data === 'object' ? data.version : 'unknown'),
						'name':(typeof data === 'object' ? data.name : 'unknown'), 
						'port':port,
						'authorize':true,
						'continue':true
					};
					
					if(data == 'invalid request' || (data && data.version)) {
						this.trigger('pairing:found', options);

						if(options.authorize) {
							this.authorize(port);
						} 

						if(options.continue) {
							this.ping(get_next_port(port));
						}
					}
				},
				error: function() {
					this.ping(get_next_port(port));
				}
			});
		},
		authorize: function(port) {
			if(authorized_domain()) {
				//this will use the old school dialogs which allow bittorrent domains to pair automatically
				this.authorize_basic(port);
			} else {
				this.authorize_iframe(port);
			}
		},
		authorize_port_success: function(port, key) {
			this.trigger('pairing:authorized', {'port':port, 'key':key});
		},
		authorize_port_error: function(port) {
			this.trigger('pairing:denied', port);
		},
		authorize_basic: function(port) {
			jQuery.ajax({
				url: get_dialog_pair_url(port),
				dataType: 'jsonp',
				success: _.bind(this.authorize_port_success, this, port),
				error: _.bind(this.authorize_port_error, this, port)
			});
		},
		authorize_iframe: function(port) {
			//make sure that we've loaded what we need to display
			if(typeof jQuery.facebox === 'undefined') {
				getCSS('http://apps.bittorrent.com/torque/facebox/src/facebox.css');
				jQuery.getScript('http://apps.bittorrent.com/torque/facebox/src/facebox.js', _.bind(this.authorize, this, port));
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
			frame.attr('src', get_iframe_pair_url(port));
			frame.css('padding', '0px');
			frame.css('margin', '0px');
			dialog.append(frame);

			jQuery(window).on('message', _.bind(function(port, data) {
				if(data && data.originalEvent && data.originalEvent.data && data.originalEvent.data !== 'denied') {
					this.authorize_port_success(port, data.originalEvent.data);
				} else {
					this.authorize_port_error(port);
				}
				jQuery(document).trigger('close.facebox');
				jQuery('#pairing').remove();
			}, this, port));

			dialog.hide();
			jQuery('body').append(dialog);
			jQuery.facebox({ div: '#pairing' });
		}
	});
}).call(this);