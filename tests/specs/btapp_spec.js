(function() {
	describe('Btapp', function() {
		beforeEach(function() {
		});
		it('connects', function() {
			runs(function() {
				this.connected = false;
				this.paired = false;
				this.btapp = new Btapp;
				this.btapp.bind('plugin:install_plugin', function(options) {
					options.install = false;
				});
				this.btapp.bind('all', _.bind(function(event, info) {
					if(event === 'pairing:found') {
						this.paired = true;
						expect(info.name).toEqual('Torque');
						expect(info.version).toEqual('4.2');
					} else if(event === 'client:connected') {
						this.connected = true;
					}
				}, this));
				this.btapp.connect();
			});
			
			waitsFor(function() {
				return this.connected;
			}, "client connection", 15000);
			
			runs(function() {
				expect(this.paired);
				expect(this.connected);
			});
		});
	});
}).call(this);
