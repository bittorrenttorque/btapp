(function() {
	describe('Btapp Pairing', function() {
		beforeEach(function() {
			this.btapp = new Btapp;
			this.btapp.bind('plugin:install_plugin', function(options) {
				options.install = false;
			});
		});
		afterEach(function() {
			this.btapp.disconnect();
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
			}, "client pairing", 15000);
			
			runs(function() {
				expect(this.paired).toBeTruthy();
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
				expect(this.connected).toBeTruthy();
			});
		});
	});
	describe('Btapp Client Function Calls', function() {
		it('returns btapp.bt functions from torque', function() {
			runs(function() {
				this.btapp = new Btapp;
				this.btapp.connect();
			});

			waitsFor(function() {
				return 'create' in this.btapp.bt;
			}, "functions", 5000);
			
			runs(function() {
				expect(this.btapp.bt.browseforfiles).toBeDefined();
				expect(this.btapp.bt.browseforfolder).toBeDefined();
				expect(this.btapp.bt.clear_incoming_messages).toBeDefined();
				expect(this.btapp.bt.connect_remote).toBeDefined();
				expect(this.btapp.bt.create).toBeDefined();
				expect(this.btapp.bt.ready_for_events).toBeDefined();
				expect(this.btapp.bt.resolve_country).toBeDefined();
				expect(this.btapp.bt.sendtopeer).toBeDefined();
				this.btapp.disconnect();
			});
		});
		it('successfully adds a torrent to torque', function() {
			runs(function() {
				this.btapp = new Btapp;
				this.btapp.connect();
			});
			
			waitsFor(function() {
				return this.btapp.get('add') && 'torrent' in this.btapp.get('add').bt;
			}, "add", 5000);
			
			runs(function() {
				this.btapp.get('add').bt.torrent(_.bind(function(ret) {}, this), 'http://www.clearbits.net/get/1684-captive---bittorrent-edition.torrent');
			});
			
			waitsFor(function() {
				return this.btapp.get('torrent') && this.btapp.get('torrent').get("C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A");
			}, "torrent added", 5000);
		});
		it('successfully removes a torrent from torque', function() {
			runs(function() {
				this.btapp = new Btapp;
				this.btapp.connect();
			});

			waitsFor(function() {
				return this.btapp.get('torrent') && this.btapp.get('torrent').get("C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A");
			}, "torrent added", 5000);
			
			runs(function() {
				this.btapp.get('torrent').get("C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A").bt.remove();
			});
			
			waitsFor(function() {
				return !this.btapp.get('torrent') || !this.btapp.get('torrent').get("C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A");
			}); 
		});
	});
}).call(this);
