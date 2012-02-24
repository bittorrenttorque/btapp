// (c) 2012 Kyle Graehl, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

window.Pairing = Backbone.Model.extend({
	initialize: function() {
		this.i = 0;
		this.curport = -1;
		this.numfound = 0; // track # found so can trigger "none found" event
		this.local_url = null;
		this.resultImg = null;
		this.highest_port_possbile = 50000;
		this.realistic_give_up_after_port = 15000; // don't bother scanning all the ports.
		assert( this.realistic_give_up_after_port < this.highest_port_possbile );
	},
	scan: function(options) {
		this.options = options || {};
		this.initialize();
		this.scan_start_time = new Date();
		this.resultImg = new Image();
		var _this = this;

		this.resultImg.onerror = function() {
			if (_this.options.timeout && (new Date() - _this.scan_start_time > _this.options.timeout)) {
				if (_this.numfound == 0) {
					_this.trigger('pairing:nonefound', { reason: 'timeout' } );
				}
			} else if (_this.curport > _this.realistic_give_up_after_port) { // highest_port_possible takes too long...
				if (_this.numfound == 0) {
					_this.trigger('pairing:nonefound', { reason: 'ended scan' } );
				}
			} else {
				_this.i++;
				_this.pingimg();
			}
		};

		this.resultImg.onload = function() { _this.port_found(_this.curport); };

		_this.i = 0;
		_this.pingimg();
	},
	get_domain: function() {
		return 'http://127.0.0.1';
	},
	get_ping_img_url: function(port) {
		return this.get_domain() + ':' + port + '/gui/pingimg';
	},
	get_pair_url: function(port) {
		return this.get_domain() + ':' + port + '/gui/pair?name=' + encodeURIComponent(window.location.origin);
	},
	pingimg: function() {
		this.curport = 7 * Math.pow(this.i, 3) + 3 * Math.pow(this.i, 2) + 5 * this.i + 10000;
		var url = this.get_ping_img_url(this.curport);
		this.resultImg.src = url;
	},
	port_found: function(port) {
		// found a listening port. now check its version...
		this.local_url = "http://127.0.0.1:" + port;

		this.test_port({
			success: _.bind(function(data, status, xhr) {
				this.numfound += 1;
				
				var options = { 
					'version':(typeof data === 'object' ? data.version : 'unknown'),
					'name':(typeof data === 'object' ? data.name : 'unknown'), 
					'port':port, 
					'continue_scan':true, 
					'attempt_authorization':true 
				};
				
				if (data == 'invalid request' || (data && data.version)) {
					this.trigger('pairing:found', options);
				}

				if(options.attempt_authorization) {
					this.authorize_port(port);
				}
				if(options.continue_scan) {
					// keep scanning for other clients!
					this.i++;
					this.pingimg();
				}	
			}, this),
			error: _.bind(function(xhr, status, text) {
				// a client responded to /gui/pingimg but had some other error on fetching "/version"
				// should not happen, but report an event anyway.
				this.trigger('pairing:error', { xhr: xhr, status: status, text: text } );
			}, this)
		});
	},
	authorize_port_success: function(port, data, status, xhr) {
		this.trigger('pairing:authorized', {'port':port, 'key':data});
	},
	authorize_port_error: function(port) {
		this.trigger('pairing:authorization_failed', port);
	},
	authorize_port: function(port) {
		jQuery.ajax({
			url: this.get_pair_url(port),
			dataType: 'jsonp',
			success: _.bind(this.authorize_port_success, this, port),
			error: _.bind(this.authorize_port_error, this, port)
		});
	},
	test_port: function(opts) {
		var test_pair_url = this.local_url + '/version/';
		jQuery.ajax({
			url: test_pair_url,
			dataType: 'jsonp',
			success: opts.success,
			error: opts.error
		});
	}
});
