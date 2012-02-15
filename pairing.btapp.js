(function() {
    window.Pairing = Backbone.Model.extend({
        initialize: function() {
            this.i = 0;
            this.curport = -1;
            this.local_url = null;
            this.resultImg = null;
            this.timeout = 1000;
            this.realistic_give_up_after_port = 11000;
        },
        scan: function() {
            this.scan_start_time = new Date();
            this.resultImg = new Image();
            var _this = this;

            this.resultImg.onerror = function() {
                if (_this.timeout && (new Date() - _this.scan_start_time > _this.timeout)) {
                    _this.trigger('pairing:timeout');
                } else if (_this.curport > _this.realistic_give_up_after_port) { // highest_port_possible takes too long...
                    _this.trigger('pairing:port_scan_failed');
                } else {
                    _this.i++;
                    _this.pingimg();
                }
            };

            this.resultImg.onload = function() { _this.port_found(_this.curport); };

            _this.i = 0;
            _this.pingimg();
        },
        pingimg: function() {
            this.curport = 7 * Math.pow(this.i, 3) + 3 * Math.pow(this.i, 2) + 5 * this.i + 10000;
            var url = 'http://127.0.0.1:' + this.curport + '/gui/pingimg';
            this.resultImg.src = url;
        },
        port_found: function(port) {
            // found a listening port. now check its version...
            this.local_url = "http://127.0.0.1:" + port;

            var _this = this;
            this.test_port({ 
                success: function(data, status, xhr) {
                    if (data == 'invalid request') {
                        // utorrent/bittorrent old version without api v2
                        console.log('found non-compatible client on', _this.local_url);
                        _this.i++;
                        _this.pingimg();
                        _this.trigger('pairing:client', _this.local_url);
                    } else if (data.error == 'invalid request type') {
                        _this.trigger('pairing:torque', _this.local_url);
                    } else {
                        _this.trigger('pairing:other', _this.local_url);
                    }
                },
                error: function(xhr, status, text) {
                    _this.trigger('pairing:error', xhr);
                }
            });
        },
        test_port: function(opts) {
            console.log('test port', this.local_url);
            var test_pair_url = this.local_url + '/btapp/';
            jQuery.ajax({ 
                url: test_pair_url,
                dataType: 'jsonp',
                success: opts.success,
                error: opts.error
            });
        }
    });
}).call(this);