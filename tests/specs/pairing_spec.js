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
						expect(info.version).toEqual('4.2.1');
					}, this));
					this.pairing.scan();
				});
				
				waitsFor(function() {
					return this.paired;
				}, "client pairing", 15000);
				
				runs(function() {
					expect(this.paired).toBeTruthy();
					this.pairing.stop();
				});
			});
			it('pairs repeatedly to the same port', function() {
				runs(function() {
					this.port = undefined;
					this.pairing = new Pairing;
					this.paired = false;
					this.pairing.bind('pairing:found', _.bind(function(info) {
						this.paired = true;
						expect(info.name).toEqual('Torque');
						expect(info.version).toEqual('4.2.1');
						if(this.port) {
							expect(info.port).toEqual(this.port);
						}
						this.port = info.port;
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
					this.pairing.stop();
				});
			});
		});
	});
}).call(this);
