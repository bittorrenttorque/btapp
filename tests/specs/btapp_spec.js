(function() {
	describe('Functional Tests', function() {
		describe('Pairing', function() {
			it('pairs', function() {
				runs(function() {
					this.pairing = new Pairing;
					this.paired = false;
					this.pairing.bind('pairing:found', _.bind(function(options) {
						this.paired = true;
						expect(options.name).toEqual('SoShare');
						options.authorize = false;
						options.continue = false;
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
						expect(options.name).toEqual('SoShare');
						if(this.port) {
							expect(options.port).toEqual(this.port);
						}
						this.port = options.port;
						options.authorize = false;
						options.continue = false;
					}, this));
					this.pairing.scan();
				});
				
				waitsFor(function() {
					return this.paired;
				}, "client pairing", 15000);
				
				runs(function() {
					expect(this.paired).toBeTruthy();
					this.paired = false;
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
						expect(info.name).toEqual('SoShare');
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
		describe('Btapp session inconsistencies', function() {
			it('connects, gets state, disconnects, repeatedly', function() {
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect();
					this.remote = false;
					this.username = 'kalsjdflkjsflkjsflkjslfjslfj';
					this.password = 'kalsjdflkjsflkjsflkjslfjslfj';
					this.connected = false;

					this.btapp.bind('remoteStatus', function(status) {
						debugger;
					});
					debugger;
				});
				waitsFor(function() {
					return 'connect_remote' in this.btapp;
				}, "remote available", 5000);

				runs(function() {
					debugger;
					this.btapp.connect_remote(this.username, this.password);
				});

				waitsFor(function() {
					return this.connected;
				}, "connected", 5000);
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
			it('returns a deferred object on function calls', function() {
				waitsFor(function() {
					return this.btapp.get('events');
				}, "events", 5000);
				
				runs(function() {
					//unfortunately jQuery.Deferred does not support instance of, so
					//lets just verify that the most common portions of the interface
					//exist.
					var ret = this.btapp.get('events').keys();
					expect('done' in ret).toBeTruthy();
					expect('fail' in ret).toBeTruthy();
					expect('always' in ret).toBeTruthy();
				});
			});
			it('adds a torrent to torque', function() {
				waitsFor(function() {
					return this.btapp.get('add') && 'torrent' in this.btapp.get('add').bt;
				}, "add", 5000);
				
				runs(function() {
					this.btapp.get('add').bt.torrent('http://www.clearbits.net/get/1684-captive---bittorrent-edition.torrent');
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
					this.btapp.get('torrent').each(function(torrent) { torrent.bt.remove(); });
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
					this.btapp.get('add').bt.torrent('http://www.clearbits.net/get/59-trusted-computing.torrent');
				});
				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4');
				}, 'torrent to appear after being added', 5000);
			});
			it('deletes those popular torrents', function() {
				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4');
				}, 'torrent to be detected', 5000);
				runs(function() {
					this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4').bt.remove();
				});
				waitsFor(function() {
					return !this.btapp.get('torrent') || !this.btapp.get('torrent').get('7EA94C240691311DC0916A2A91EB7C3DB2C6F3E4');
				}, 'torrent to be deleted', 5000);
			});
			it('adds first torrent that causes problems with encoding', function() {
				var hash = '929AC6FA58F74D40DA23ECAEA53145488679BFAB';
				var magnet_link = 'magnet:?xt=urn:btih:' + hash + '&tr=udp://tracker.openbittorrent.com:80/announce';
				waitsFor(function() {
					return this.btapp.get('add') && this.btapp.get('add').torrent && this.btapp.get('torrent');
				}, 'add and torrent objects to be detected', 5000);
				runs(function() {
					this.btapp.get('add').torrent(magnet_link);
				});
				waitsFor(function() {
					var torrent = this.btapp.get('torrent').get(hash);
					if(torrent) {
						var files = torrent.get('file');
						return files && files.length > 0;
					}
					return false;
				}, 'metadata to resolve', 20000);
			});
			it('adds second torrent that causes problems with encoding', function() {
				var hash = 'F1CD5318D3D4F716017AB8401453A4A798227EF5';
				var magnet_link = 'magnet:?xt=urn:btih:' + hash + '&tr=udp://tracker.openbittorrent.com:80/announce';
				waitsFor(function() {
					return this.btapp.get('add') && this.btapp.get('add').torrent && this.btapp.get('torrent');
				}, 'add and torrent objects to be detected', 5000);
				runs(function() {
					this.btapp.get('add').torrent(magnet_link);
				});
				waitsFor(function() {
					var torrent = this.btapp.get('torrent').get(hash);
					if(torrent) {
						var files = torrent.get('file');
						return files && files.length > 0;
					}
					return false;
				}, 'metadata to resolve', 20000);
			});
		});
		describe('Btapp Interactive Client Function Calls', function() {
			it('OPERATOR: SELECT ANY FILE', function() {});
			it('shows a file selection dialog and creates a torrent', function() {
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect();	
					this.hash = null;
				});
				
				waitsFor(function() {
					return this.btapp.bt.browseforfiles;
				});
				
				runs(function() {
					this.btapp.bt.browseforfiles(
						_.bind(function(files) { 
							this.files = files;
							expect(_.values(this.files).length).toEqual(1);
							this.btapp.bt.create(
								function() {}, 
								'', 
								_.values(this.files), 
								_.bind(function(hash) { this.hash = hash; }, this)
							); 
						}, this)
					);
				});
				
				waitsFor(function() {
					return this.files;
				}, 20000, 'file selection');

				waitsFor(function() {
					return this.hash;
				}, 20000, 'torrent creation');

				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
				}, 5000, 'torrent to show up in the diffs');
			});
			it('OPERATOR: SELECT A FILE WITH A SPACE IN THE NAME', function() {});
			it('it creates a torrent from a file with a space in the name', function() {
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect();	
					this.hash = null;
				});
				
				waitsFor(function() {
					return this.btapp.bt.browseforfiles;
				});
				
				runs(function() {
					this.btapp.bt.browseforfiles(
						_.bind(function(files) { 
							this.files = files;
							expect(_.values(this.files).length).toEqual(1);
							expect(_.values(this.files)[0].indexOf(' ')).not.toEqual(-1);
							this.btapp.bt.create(
								function() {}, 
								'', 
								_.values(this.files), 
								_.bind(function(hash) { this.hash = hash; }, this)
							); 
						}, this)
					);
				});
				
				waitsFor(function() {
					return this.files;
				}, 20000, 'file selection');

				waitsFor(function() {
					return this.hash;
				}, 20000, 'torrent creation');

				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
				}, 5000, 'torrent to show up in the diffs');
			});
			it('OPERATOR: SELECT A FILE WITH A UNICODE CHARACTER IN THE NAME', function() {});
			it('it creates a torrent from a file with a unicode character in the name', function() {
				function isDoubleByte(str) {
				    for (var i = 0, n = str.length; i < n; i++) {
				        if (str.charCodeAt( i ) > 255) { return true; }
				    }
				    return false;
				}
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect();	
					this.hash = null;
				});
				
				waitsFor(function() {
					return this.btapp.bt.browseforfiles;
				});
				
				runs(function() {
					this.btapp.bt.browseforfiles(
						_.bind(function(files) { 
							this.files = files;
							expect(_.values(this.files).length).toEqual(1);
							expect(isDoubleByte(_.values(this.files)[0])).toBeTruthy();
							this.btapp.bt.create(
								function() {}, 
								'', 
								_.values(this.files), 
								_.bind(function(hash) { this.hash = hash; }, this)
							); 
						}, this)
					);
				});
				
				waitsFor(function() {
					return this.files;
				}, 20000, 'file selection');

				waitsFor(function() {
					return this.hash;
				}, 20000, 'torrent creation');

				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
				}, 5000, 'torrent to show up in the diffs');
			});
			it('OPERATOR: SELECT A FILE WITH A \'(\' CHARACTER IN THE NAME', function() {});
			it('it creates a torrent from a file with a \'(\' character in the name', function() {
				function isDoubleByte(str) {
				    for (var i = 0, n = str.length; i < n; i++) {
				        if (str.charCodeAt( i ) > 255) { return true; }
				    }
				    return false;
				}
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect();	
					this.hash = null;
				});
				
				waitsFor(function() {
					return this.btapp.bt.browseforfiles;
				});
				
				runs(function() {
					this.btapp.bt.browseforfiles(
						_.bind(function(files) { 
							this.files = files;
							expect(_.values(this.files).length).toEqual(1);
							expect(_.values(this.files)[0].indexOf('(')).not.toEqual(-1);
							this.btapp.bt.create(
								function() {}, 
								'', 
								_.values(this.files), 
								_.bind(function(hash) { this.hash = hash; }, this)
							); 
						}, this)
					);
				});
				
				waitsFor(function() {
					return this.files;
				}, 20000, 'file selection');

				waitsFor(function() {
					return this.hash;
				}, 20000, 'torrent creation');

				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
				}, 5000, 'torrent to show up in the diffs');
			});
			it('OPERATOR: SELECT A FILE WITH A \')\' CHARACTER IN THE NAME', function() {});
			it('it creates a torrent from a file with a \')\' character in the name', function() {
				function isDoubleByte(str) {
				    for (var i = 0, n = str.length; i < n; i++) {
				        if (str.charCodeAt( i ) > 255) { return true; }
				    }
				    return false;
				}
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect();	
					this.hash = null;
				});
				
				waitsFor(function() {
					return this.btapp.bt.browseforfiles;
				});
				
				runs(function() {
					this.btapp.bt.browseforfiles(
						_.bind(function(files) { 
							this.files = files;
							expect(_.values(this.files).length).toEqual(1);
							expect(_.values(this.files)[0].indexOf(')')).not.toEqual(-1);
							this.btapp.bt.create(
								function() {}, 
								'', 
								_.values(this.files), 
								_.bind(function(hash) { this.hash = hash; }, this)
							); 
						}, this)
					);
				});
				
				waitsFor(function() {
					return this.files;
				}, 20000, 'file selection');

				waitsFor(function() {
					return this.hash;
				}, 20000, 'torrent creation');

				waitsFor(function() {
					return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
				}, 5000, 'torrent to show up in the diffs');
			});
		});
	});
}).call(this);
