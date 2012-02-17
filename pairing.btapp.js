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
        this._cancel = false;
        this.resultImg = null;
        this.highest_port_possbile = 50000;
        this.realistic_give_up_after_port = 15000; // don't bother scanning all the ports.
        assert( this.realistic_give_up_after_port < this.highest_port_possbile );
    },
    stop: function() {
        this._cancel = true;
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
    pingimg: function() {
        if (this._cancel) { return; }
        this.curport = 7 * Math.pow(this.i, 3) + 3 * Math.pow(this.i, 2) + 5 * this.i + 10000;
        var url = 'http://127.0.0.1:' + this.curport + '/gui/pingimg';
        this.resultImg.src = url;
    },
    port_found: function(port) {
        if (this._cancel) { return; }
        // found a listening port. now check its version...
        this.local_url = "http://127.0.0.1:" + port;

        var _this = this;
        this.test_port({ 
            success: function(data, status, xhr) {
                _this.numfound += 1;
                if (data && data.version) {
                    data.port = port;
                    _this.trigger('pairing:found', data);
                } else if (data == 'invalid request') {
                    // utorrent/bittorrent old version without api v2
                    _this.trigger('pairing:found', { 'version':'unknown', 'name':'unknown', 'port':port } );
                } else {
                    // not sure what other things could be
                    // returned, but other processes or versions
                    // could return weird stuff.
                    _this.trigger('pairing:found', { 'version':'unknown', 'name':'unknown', 'port':port, 'data': data } );
                }
                // keep scanning for other clients!
                _this.i++;
                _this.pingimg();

            },
            error: function(xhr, status, text) {
                // a client responded to /gui/pingimg but had some other error on fetching "/version"
                // should not happen, but report an event anyway.
                _this.trigger('pairing:error', { xhr: xhr, status: status, text: text } );
            }
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
