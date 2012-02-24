(function() {
	describe('Pairing Functional Tests', function() {
		describe('Pairing', function() {
			it('pairs', function() {
				runs(function() {
					this.pairing = new Pairing;
					this.paired = false;
					this.pairing.bind('pairing:found', _.bind(function(info) {
						this.paired = true;
						expect(info.name).toEqual('Torque');
						expect(info.version).toEqual(Btapp.VERSION);
					}, this));
					this.pairing.scan();
				});
				
				waitsFor(function() {
					return this.paired;
				}, "client pairing", 15000);
				
				runs(function() {
					expect(this.paired).toBeTruthy();
				});
			});
			it('pairs repeatedly to the same port', function() {
				runs(function() {
					this.port = undefined;
					this.pairing = new Pairing;
					this.paired = false;
					this.pairing.bind('pairing:found', _.bind(function(options) {
						this.paired = true;
						expect(options.name).toEqual('Torque');
						expect(options.version).toEqual(Btapp.VERSION);
						if(this.port) {
							expect(options.port).toEqual(this.port);
						}
						this.port = options.port;
					}, this));
					this.pairing.scan();
				});
				
				waitsFor(function() {
					return this.paired;
				}, "client pairing", 15000);
				
				runs(function() {
					expect(this.paired).toBeTruthy();
					this.paired = false;
					this.pairing.stop();
					this.pairing.scan();
				});
				
				waitsFor(function() {
					return this.paired;
				}, "client pairing again", 15000);
				
				runs(function() {
					expect(this.paired).toBeTruthy();
				});
			});
		});
	});
}).call(this);
