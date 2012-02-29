(function() {
	describe('Btapp Functional Tests', function() {
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
						expect(info.version).toEqual(Btapp.VERSION);
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
			beforeEach(function() {
				this.btapp = new Btapp;
				this.btapp.connect();
			});
			afterEach(function() {
				this.btapp.disconnect();
			});
			it('returns btapp.bt functions from torque', function() {
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
				});
			});
			it('adds a torrent to torque', function() {
				waitsFor(function() {
					return this.btapp.get('add') && 'torrent' in this.btapp.get('add').bt;
				}, "add", 5000);
				
				runs(function() {
					this.btapp.get('add').bt.torrent(_.bind(function(ret) {}, this), 'http://www.clearbits.net/get/1684-captive---bittorrent-edition.torrent');
				});
				
				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get('C106173C44ACE99F57FCB83561AEFD6EAE8A6F7A');
				}, "torrent added", 5000);
			});
			it('removes all torrents from torque', function() {
				waitsFor(function() {
					return this.btapp.get('torrent');
				}, "torrent to be added", 5000);
				
				runs(function() {
					expect(this.btapp.get('torrent'));
					this.btapp.get('torrent').each(function(torrent) { torrent.bt.remove(function() {}); });
				});
				
				waitsFor(function() {
					return this.btapp.get('torrent').length === 0;
				}, "all torrents to be removed", 5000); 
			});
			it('connects and disconnects to the client over and over', function() {
				runs(function() {
					this.btapp.bind('client:connected', _.bind(function() {
						this.connected = true;
					}, this));
				});
				for(var i = 0; i < 5; i++) {
					waitsFor(function() { return this.connected; });
					runs(function() { this.btapp.disconnect(); this.connected = false; });
					waits(1000);
					runs(function() { this.btapp.connect(); });
				}				
			});
			it('adds several popular torrents', function() {
				waitsFor(function() {
					return this.btapp.get('add') && 'torrent' in this.btapp.get('add').bt;
				}, 'add', 5000);
				runs(function() {
					this.btapp.get('add').bt.torrent(function() { }, 'http://www.clearbits.net/get/59-trusted-computing.torrent');
				});
				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4');
				}, 'torrent to appear after being added', 5000);
			});
			it('downloads those popular torrents', function() {
				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4') && this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4').get('properties');
				});
				waitsFor(function() {
					return this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4').get('properties').get('downloaded') > 0;
				}, 'some of the file to be downloaded');
			});
			it('deletes those popular torrents', function() {
				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4');
				}, 'torrent to be detected', 5000);
				runs(function() {
					this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4').bt.remove(function() {});
				});
				waitsFor(function() {
					return !this.btapp.get('torrent') || !this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4');
				}, 'torrent to be deleted', 5000);
			});
		});
		describe('Btapp Interactive Client Function Calls', function() {
			it('shows a file selection dialog and creates a torrent', function() {
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect();	
					this.created = false;
				});
				
				waitsFor(function() {
					return this.btapp.bt.browseforfiles;
				});
				
				runs(function() {
					this.btapp.bt.browseforfiles(
						function() {}, 
						_.bind(function(files) { 
							this.files = files;
							this.btapp.bt.create(
								function() {}, 
								'', 
								_.values(this.files), 
								_.bind(function() { this.created = true; }, this)
							); 
						}, this)
					);
				});
				
				waitsFor(function() {
					return this.files;
				}, 20000, 'file selection');

				waitsFor(function() {
					return this.created;
				}, 20000, 'torrent creation');
			});
		});
	});
}).call(this);
