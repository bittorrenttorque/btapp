(function() {
    function randomString() {
		var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
		var string_length = 0x10;
		var randomstring = '';
		for (var i=0; i<string_length; i++) {
			var rnum = Math.floor(Math.random() * chars.length);
			randomstring += chars.substring(rnum,rnum+1);
		}
		return randomstring;
	}

	describe('Torrent Metadata Resolution', function() {
		it('resolves promise', function() {
			runs(function() {
				this.hash = '5E60858AA93FBB5CE4D77CBC7B8FB7428517D8B8';
				this.btapp = new Btapp();
				this.btapp.on('all', _.bind(console.log, console));
				this.btapp.connect();
				this.resolved = false;
				var cleanup = function() {
					var torrents = this.btapp.get('torrent');
					if(torrents) {
						var torrent = torrents.get(this.hash);
						if(torrent) {
							torrent.remove(1);
						}
					}
					this.btapp.disconnect();
				};
				var magnet = 'magnet:?xt=urn:btih:' + this.hash;
				this.btapp.resolve_torrent_metadata(magnet).then(_.bind(function(torrent) {
					expect(torrent.get('file').length).toEqual(20);
					cleanup.call(this);
					this.resolved = true;
				}, this), _.bind(function() {
					cleanup.call(this);
					expect(false).toBeTruthy();
				}, this));
				
			});
			waitsFor(function() {
				return this.resolved;
			}, 'metadata to resolve', 20000);
		});
	});

	describe('Functional Tests', function() {
		describe('Pairing', function() {
			it('pairs', function() {
				runs(function() {
					this.pairing = new Pairing({plugin:false});
					this.paired = false;
					this.pairing.bind('pairing:found', _.bind(function(options) {
						this.paired = true;
						expect(options.name).toEqual('Torque');
						options.authorize = false;
						options.abort = true;
					}, this));
					this.pairing.connect();
				});
				
				waitsFor(function() {
					return this.paired;
				}, "client pairing", 15000);
				
				runs(function() {
					this.pairing.disconnect();
					expect(this.paired).toBeTruthy();
				});
			});
			it('pairs repeatedly to the same port', function() {
				runs(function() {
					this.port = undefined;
					this.pairing = new Pairing({plugin:false});
					this.paired = false;
					this.pairing.bind('pairing:found', _.bind(function(options) {
						this.paired = true;
						expect(options.name).toEqual('Torque');
						if(this.port) {
							expect(options.port).toEqual(this.port);
						}
						this.port = options.port;
						options.authorize = false;
						options.abort = true;
					}, this));
					this.pairing.connect();
				});
				
				waitsFor(function() {
					return this.paired;
				}, "client pairing", 15000);
				
				runs(function() {
					this.pairing.disconnect();
					expect(this.paired).toBeTruthy();
					this.paired = false;
					this.pairing.connect();
				});
				
				waitsFor(function() {
					return this.paired;
				}, "client pairing again", 15000);
				
				runs(function() {
					this.pairing.disconnect();
					expect(this.paired).toBeTruthy();
				});
			});
		});
		describe('Btapp Concurrent Pairing', function() {
			it('uses a single jquery ajax request for multiple native pairing requests to the same client', function() {
				runs(function() {
					this.success = false;
					this.btapps = [];
					var connections = [];
					jQuery.jStorage.deleteKey('Torque_pairing_key');
					for(var i = 0; i < 4; ++i) {
						var btapp = new Btapp;
						this.btapps.push(btapp);
						connections.push(btapp.connect({product: 'Torque', pairing_type: 'native', plugin: false}));
					}
					jQuery.when.apply(this, connections).done(_.bind(function() {
						this.success = true;
					}, this));
				});
				waitsFor(function() { return this.success; }, 10000);
				runs(function() {
					_.each(this.btapps, function(btapp) { btapp.disconnect(); });
				});
			});
			it('uses a single plugin ajax request for multiple native pairing requests to the same client', function() {
				runs(function() {
					this.success = false;
					this.btapps = [];
					var connections = [];
					jQuery.jStorage.deleteKey('Torque_pairing_key');
					for(var i = 0; i < 4; ++i) {
						var btapp = new Btapp;
						this.btapps.push(btapp);
						connections.push(btapp.connect({product: 'Torque', pairing_type: 'native'}));
					}
					jQuery.when.apply(this, connections).done(_.bind(function() {
						this.success = true;
					}, this));
				});
				waitsFor(function() { return this.success; }, 10000);
				runs(function() {
					_.each(this.btapps, function(btapp) { btapp.disconnect(); });
				});
			});
			it('uses a single plugin ajax request for multiple iframe pairing requests to the same client', function() {
				runs(function() {
					this.success = false;
					this.btapps = [];
					var connections = [];
					jQuery.jStorage.deleteKey('Torque_pairing_key');
					for(var i = 0; i < 4; ++i) {
						var btapp = new Btapp;
						this.btapps.push(btapp);
						connections.push(btapp.connect({product: 'Torque', pairing_type: 'iframe'}));
					}
					jQuery.when.apply(this, connections).done(_.bind(function() {
						this.success = true;
					}, this));
				});
				waitsFor(function() { return this.success; }, 10000);
				runs(function() {
					_.each(this.btapps, function(btapp) { btapp.disconnect(); });
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
					jQuery.jStorage.deleteKey('Torque_pairing_key');
					this.btapp.connect();
				});
				
				waitsFor(function() {
					return jQuery.jStorage.get('Torque_pairing_key');
				}, "client pairing", 15000);
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
			it('connects and the returned deferred object resolves', function() {
				var connected = { val: false };
				runs(function() {
					this.btapp.connect().done(function() {
						connected.val = true;
					});
				});
				
				waitsFor(function() {
					return connected.val;
				}, "client connection", 15000);
				
				runs(function() {
					expect(connected.val).toBeTruthy();
				});
			});
			it('throws error when connecting to non-existent remote connection', function() {
				runs(function() {
					this.connected = false;
					this.callback = jasmine.createSpy();
					this.btapp.bind('client:error', this.callback);
					this.btapp.connect({
						username: randomString(),
						password: randomString()
					});
				});
				
				waitsFor(function() {
					return this.callback.callCount > 0;
				}, "remote connection", 15000);
				
				runs(function() {
					expect(this.callback).toHaveBeenCalled();
				});
			});
		});
		describe('Persistent Client Btapp Data', function() {
			it('has a persistent stash', function() {
				runs(function() {
					this.success = false;
					this.btapp = new Btapp;
					this.btapp.connect({pairing_type: 'native', queries: [['btapp','stash']]});

					this.btapp.on('add:stash', function(stash) {
						this.btapp.off('add:stash');
						stash.bt.set('testkey', 'testvalue');
						this.btapp.disconnect();
						this.btapp.connect();

						this.btapp.on('add:stash', function(stash) {
							if(stash.get('testkey')) {
								this.success = (stash.get('testkey') === 'testvalue');
							} else {
								stash.on('add:testkey', function() {
									this.success = (stash.get('testkey') === 'testvalue');
								}, this);
							}
						}, this);
					}, this);
				});
				
				waitsFor(function() {
					return this.success;
				}, 15000);
			});
			it('has access to stash via remote', function() {
			    function randomString() {
					var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
					var string_length = 0x10;
					var randomstring = '';
					for (var i=0; i<string_length; i++) {
						var rnum = Math.floor(Math.random() * chars.length);
						randomstring += chars.substring(rnum,rnum+1);
					}
					return randomstring;
				}
				runs(function() {
					this.works = false;
					this.btapp = new Btapp;
					this.btapp.connect({
						pairing_type: 'native', 
						queries: [
							['btapp','stash'],
							['btapp','events'],
							['btapp','connect_remote']
						]
					});
					this.btapp.on('add:bt:connect_remote', function() {
						var username = randomString();
						var password = randomString();
						this.btapp.connect_remote(username, password);
						this.btapp.on('remoteStatus', function(details) {
							if(details.status === 'Status: Accessible') {
								this.remote = new Btapp;
								this.remote.connect({
									username: username,
									password: password
								});
								this.remote.on('add:stash', function() {
									if(this.remote.get('stash').has('testkey')) {
										this.works = true;
									} else {
										this.remote.get('stash').on('add:testkey', function() {
											this.works = true;
										}, this);
									}
								}, this);
							}
						}, this);
					}, this);
				});
				waitsFor(function() {
					return this.works;
				}, 'remote', 15000);
			});
		});
		describe('Btapp Client supports all json types', function() {
			it('sets settings to the same value individually using bt.set', function() {
				runs(function() {
					this.type_number = false;
					this.type_boolean = false;
					this.type_string = false;
					this.btapp = new Btapp;
					this.btapp.connect({
						queries: [['btapp','settings','all'],['btapp','settings','set']]
					});
				});
				waitsFor(function() {
					return this.btapp.get('settings');
				}, 15000);

				runs(function() {
					this.success = false;
					this.deferreds = [];
					var settings = this.btapp.get('settings');
					_(settings.toJSON()).each(function(value, key) {
						if(key === 'id') return;
						var deferred = settings.bt.set(key, value);
						deferred.done(_.bind(function(result) {

							if(typeof value === 'number') this.type_number = true;
							if(typeof value === 'boolean') this.type_boolean = true;
							if(typeof value === 'string') this.type_string = true;

							var success = (result === 'success' || result === ('Access denied ' + key) || result === ('Read only property ' + key) || result === 'data type not supported');
							if(!success) debugger;
							expect(success).toBeTruthy();
						}, this)).fail(function(result) {
							expect(false).toBeTruthy();
						});
						this.deferreds.push(deferred);
					}, this);
				});
				runs(function() {
					jQuery.when.apply(jQuery, this.deferreds).done(_.bind(function(result) {
						_.each(this.deferreds, function(r) { 
							expect(r.isResolved()).toBeTruthy();
						});
						this.success = true;
					}, this));
				});
				waitsFor(function() {
					return this.success;
				}, 15000);
				runs(function() {
					this.success = false;
					this.deferreds = [];
					var settings = this.btapp.get('settings');
					_(settings.toJSON()).each(function(value, key) {
						if(key === 'id') return;
						var deferred = settings.bt.set(key, value);
						deferred.done(_.bind(function(result) {

							if(typeof value === 'number') this.type_number = true;
							if(typeof value === 'boolean') this.type_boolean = true;
							if(typeof value === 'string') this.type_string = true;

							var success = (result === 'success' || result === ('Read only property ' + key) || result === 'data type not supported');
							expect(success).toBeTruthy();
						}, this)).fail(function(result) {
							expect(false).toBeTruthy();
						});
						this.deferreds.push(deferred);
					}, this);
				});
				runs(function() {
					jQuery.when.apply(jQuery, this.deferreds).done(_.bind(function(result) {
						_.each(this.deferreds, function(r) { 
							expect(r.isResolved()).toBeTruthy();
						});
						this.success = true;
					}, this));
				});				
				waitsFor(function() {
					return this.success;
				}, 15000);
				runs(function() {
					expect(this.type_number && this.type_boolean && this.type_string).toBeTruthy();
					this.btapp.disconnect();
				});
			});
			it('sets settings to the same values as a batch using save', function() {
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect({
						queries: [['btapp','settings','all'],['btapp','settings','set']]
					});
				});
				waitsFor(function() {
					return this.btapp.get('settings');
				}, 15000);

				runs(function() {
					this.success = false;
					this.deferreds = [];
					var settings = this.btapp.get('settings');
					settings.save(settings.toJSON()).done(_.bind(function(result) {
						_.each(this.deferreds, function(r) { 
							expect(r.isResolved()).toBeTruthy();
						});
						this.success = true;
					}, this));
				});
				waitsFor(function() {
					return this.success;
				}, 15000);
				runs(function() {
					this.success = false;
					this.deferreds = [];
					var settings = this.btapp.get('settings');
					settings.save(settings.toJSON()).done(_.bind(function(result) {
						_.each(this.deferreds, function(r) { 
							expect(r.isResolved()).toBeTruthy();
						});
						this.success = true;
					}, this));
				});
				waitsFor(function() {
					return this.success;
				}, 15000);
				runs(function() {
					this.btapp.disconnect();
				});
			});
			it('sets gui.show_av_icon to the opposite value using bt.set', function() {
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect({
						queries: [['btapp','settings','all','gui.show_av_icon'],['btapp','settings','set']]
					});
				});
				waitsFor(function() {
					return this.btapp.get('settings');
				}, 15000);
				runs(function() {
					var settings = this.btapp.get('settings');
					this.unchanged = {};
					_(settings.toJSON()).each(function(value, key) {
						if(typeof value !== 'boolean') {
							return;
						}
						settings.on('change:' + key, function(v) {
							expect(this.unchanged[key]).toBeDefined();
							expect(settings.get(key)).toEqual(!this.unchanged[key]);
							delete this.unchanged[key];
							var num = _.keys(this.unchanged).length;
							this.success = (_.keys(this.unchanged).length === 0);
						}, this);

						settings.bt.set(key, !value).done(_.bind(function(result) {
							if(result !== ('Read only property ' + key) &&
								result !== ('data type not supported')) {
								this.unchanged[key] = value;
								this.ready = true;
							}
						}, this));
					}, this);
				});
				waitsFor(function(){
					return this.ready;
				}, 5000);
				waitsFor(function() {
					return this.success;
				}, 15000);
				runs(function() {
					this.btapp.disconnect();
				});
			});
			it('sets non-gui.show_av_icon bool settings to the opposite values individually using bt.set', function() {
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect({
						queries: [['btapp','settings','all'],['btapp','settings','set']]
					});
				});
				waitsFor(function() {
					return this.btapp.get('settings');
				}, 15000);
				runs(function() {
					var settings = this.btapp.get('settings');
					this.unchanged = {};
					_(settings.toJSON()).each(function(value, key) {
						if(key === 'gui.show_av_icon' || typeof value !== 'boolean') {
							return;
						}
						settings.on('change:' + key, function(v) {
							expect(this.unchanged[key]).toBeDefined();
							expect(settings.get(key)).toEqual(!this.unchanged[key]);
							delete this.unchanged[key];
							var num = _.keys(this.unchanged).length;
							this.success = (_.keys(this.unchanged).length === 0);
						}, this);

						settings.bt.set(key, !value).done(_.bind(function(result) {
							if(result !== ('Read only property ' + key)) {
								this.unchanged[key] = value;
								this.ready = true;
							}
						}, this));
					}, this);
				});
				waitsFor(function(){
					return this.ready;
				}, 5000);
				waitsFor(function() {
					return this.success;
				}, 15000);
				runs(function() {
					this.btapp.disconnect();
				});
			});
			it('sets torrentStatus event waits for it to match function, then sets to null and waits until null', function() {
				runs(function() {
					this.btapp = new Btapp;
					this.btapp.connect();
					this.callback = jasmine.createSpy();
				});
				waitsFor(function() {
					return this.btapp.get('events');
				}, 'events', 10000);
				runs(function() {
					this.btapp.get('events').save({
						torrentStatus: this.callback
					});
				});
				waitsFor(function() {
					return this.btapp.get('events').get('torrentStatus') === this.callback;
				}, 'torrentStatus === this.callback', 10000);
				runs(function() {
					this.btapp.get('events').save({
						torrentStatus: null
					});
				});
				waitsFor(function() {
					return this.btapp.get('events').get('torrentStatus') === null;
				}, 'torrentStatus === null', 10000);
				runs(function() {
					this.btapp.disconnect();
				});
			});
		});
		describe('Btapp Client Function Calls', function() {
			beforeEach(function() {
				this.btapp = new Btapp;
				this.btapp.connect();
			});
			describe('Tracker Scrape Function Calls', function() {
				it('scrapes a udp tracker via info hash', function() {
					var responded = false;
					waitsFor(function() {
						return this.btapp.get('tracker') && 'scrape' in this.btapp.get('tracker');
					});
					runs(function() {
						var hash = '0D8A72B221176784856673D6C9E2FD193FCD5978';
						this.btapp.get('tracker').scrape({
						  //replace with any info hash
							hash: hash,
							//replace with any other tracker announce url
							tracker: 'udp://tracker.openbittorrent.com:80/announce',
							callback: function(info) {
								debugger;
								expect(info.hash).toEqual(hash);
								expect(info.downloaded).toBeDefined();
								expect(info.complete).toBeDefined();
								expect(info.incomplete).toBeDefined();
								responded = true;
							}
						});
					});
					waitsFor(function() { return responded; });
					runs(function() { this.btapp.disconnect(); });
				});
				it('scrapes a http tracker via info hash', function() {
					var responded = false;
					waitsFor(function() {
						return this.btapp.get('tracker') && 'scrape' in this.btapp.get('tracker');
					});
					runs(function() {
						var hash = '0D8A72B221176784856673D6C9E2FD193FCD5978';
						this.btapp.get('tracker').scrape({
						  //replace with any info hash
							hash: hash,
							//replace with any other tracker announce url
							tracker: 'http://tracker001.legaltorrents.com:7070/announce',
							callback: function(info) {
								expect(info.hash).toEqual(hash);
								expect(info.downloaded).toBeDefined();
								expect(info.complete).toBeDefined();
								expect(info.incomplete).toBeDefined();
								responded = true;
							}
						});
					});
					waitsFor(function() { return responded; });
					runs(function() { this.btapp.disconnect(); });
				});
				it('scrapes a tracker via torrent file url', function() {
					var responded = false;
					waitsFor(function() {
						return this.btapp.get('tracker') && 'scrape' in this.btapp.get('tracker');
					});
					runs(function() {
						var hash = 'D9C70109CB05C181F9EC9373BE876A0D40C4D7B0';
						var url = 'http://vodo.net/media/torrents/Deadside.Pilot.2012.720p.x264-VODO.torrent';
						this.btapp.get('tracker').scrape({
						  //replace with any info hash
							url: url,
							//replace with any other tracker announce url
							callback: function(info) {
								expect(info.hash).toEqual(hash);
								expect(info.downloaded).toBeDefined();
								expect(info.complete).toBeDefined();
								expect(info.incomplete).toBeDefined();
								responded = true;
							}
						});
					});
					waitsFor(function() { return responded; }, 10000);
					runs(function() { this.btapp.disconnect(); });
				});
			});
			it('returns btapp.bt functions from torque', function() {
				waitsFor(function() {
					return 'create' in this.btapp.bt;
				}, "functions", 5000);
				
				runs(function() {
					expect(this.btapp.bt.browseforfiles).toBeDefined();
					expect(this.btapp.bt.browseforfolder).toBeDefined();
					expect(this.btapp.bt.connect_remote).toBeDefined();
					expect(this.btapp.bt.create).toBeDefined();
				});
				runs(function() { this.btapp.disconnect(); });
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
				runs(function() { this.btapp.disconnect(); });
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
				runs(function() { this.btapp.disconnect(); });
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
				runs(function() { this.btapp.disconnect(); });
			});
			it('connects and disconnects to the client over and over', function() {
				runs(function() {
					this.btapp.bind('client:connected', _.bind(function() {
						this.connected = true;
					}, this));
				});
				runs(function() {
					for(var i = 0; i < 5; i++) {
						waitsFor(function() { return this.connected; });
						runs(function() { this.btapp.disconnect(); this.connected = false; });
						waits(1000);
						runs(function() { this.btapp.connect(); });
					}				
				});
				runs(function() { this.btapp.disconnect(); });
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
				runs(function() { this.btapp.disconnect(); });
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
				runs(function() { this.btapp.disconnect(); });
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
					return this.btapp.get('torrent').get(hash);
				}, 'magnet link to add', 20000);

				waitsFor(function() {
					var torrent = this.btapp.get('torrent').get(hash);
					if(torrent) {
						var files = torrent.get('file');
						return files && files.length > 0;
					}
					return false;
				}, 'metadata to resolve', 20000);
				runs(function() { this.btapp.disconnect(); });
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
					return this.btapp.get('torrent').get(hash);
				}, 'magnet link to add', 20000);

				
				waitsFor(function() {
					var torrent = this.btapp.get('torrent').get(hash);
					if(torrent) {
						var files = torrent.get('file');
						return files && files.length > 0;
					}
					return false;
				}, 'metadata to resolve', 20000);
				runs(function() { this.btapp.disconnect(); });
			});
			it('adds a torrent that causes problems with 64 bit int wrapping', function() {
				var hash = 'D5B5A1D27F19E5E28A156EF17869D7B8BE8E4CF3';
				var magnet_link = 'magnet:?xt=urn:btih:' + hash + '&tr=udp://tracker.openbittorrent.com:80/announce';
				waitsFor(function() {
					return this.btapp.get('add') && this.btapp.get('add').torrent && this.btapp.get('torrent');
				}, 'add and torrent objects to be detected', 5000);
				runs(function() {
					this.btapp.get('add').torrent(magnet_link);
				});
				waitsFor(function() {
					return this.btapp.get('torrent').get(hash);
				}, 'magnet link to add', 20000);
				waitsFor(function() {
					var torrent = this.btapp.get('torrent').get(hash);
					if(torrent) {
						var files = torrent.get('file');
						return files && files.length > 0;
					}
					return false;
				}, 'metadata to resolve', 20000);
				runs(function() { this.btapp.disconnect(); });
			});
		});
	});
}).call(this);
