(function() {
	describe('Btapp', function() {
		beforeEach(function() {
			this.btapp = new Btapp;
			this.btapp.bind('plugin:install_plugin', function(options) {
				options.install = false;
			});
		});
		it('pairs', function() {
			runs(function() {
				this.paired = false;
				this.btapp.bind('pairing:found', _.bind(function(info) {
					this.paired = true;
					expect(info.name).toEqual('Torque');
					expect(info.version).toEqual('4.2');
				}, this));
				this.btapp.connect();
			});
			
			waitsFor(function() {
				return this.paired;
			}, "client connection", 15000);
			
			runs(function() {
				expect(this.paired);
			});
		});
		it('connects', function() {
			runs(function() {
				this.connected = false;
				this.btapp.bind('client:connected', _.bind(function() {
					this.connected = true;
				}, this));
				this.btapp.connect();
			});
			
			waitsFor(function() {
				return this.connected;
			}, "client connection", 15000);
			
			runs(function() {
				expect(this.connected);
			});
		});
	});
}).call(this);
