(function() {
	describe('Btapp Unit Tests', function() {
		describe('BtappModel state updates', function() {
			it('adds and removes an attribute', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(model.get('testkey')).toEqual('testvalue');
				model.updateState('testsession', null, {'testkey':'testvalue'}, 'testurl');
				expect(model.get('testkey')).toBeUndefined();
			});
			it('adds attributes and clears state', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(model.get('testkey')).toEqual('testvalue');
				model.clearState();
				expect(model.get('testkey')).toBeUndefined();
			});
			it('throws an error if removing an attribute and providing the wrong previous value', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				var exception = 'trying to remove an attribute, but did not provide the correct previous value';
				expect(function() { model.updateState('testsession', null, {'testkey':'testvalue1'}, 'testurl') }).toThrow(exception);
			});
			it('throws an error if changing an attribute and providing the wrong previous value', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				var exception = 'trying to update an attribute, but did not provide the correct previous value';
				expect(function() { model.updateState('testsession', {'testkey':'testvalue2'}, {'testkey':'testvalue1'}, 'testurl') }).toThrow(exception);
			});
			it('throws an error if changing an attribute to the same value', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				var exception = 'trying to set a variable to the existing value';
				expect(function() { model.updateState('testsession', {'testkey':'testvalue'}, {'testkey':'testvalue'}, 'testurl') }).toThrow(exception);
			});
			it('adds a function', function() {
				var model = new BtappModel({'id':'test'});
				model.client = new LocalTorrentClient({'btapp':model});
				model.updateState('testsession', {'testfunc':'[nf]()'}, null, 'testurl');
				expect(typeof model.bt.testfunc).toEqual('function');
			});
			it('adds and removes a BtappModel', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey1':{'testkey2':{'testkey3':'testvalue'}}}, null, 'testurl');
				expect(model.get('testkey1') instanceof BtappModel).toBeTruthy();
				expect(model.get('testkey1').get('testkey2') instanceof BtappModel).toBeTruthy();
				model.updateState('testsession', null, {'testkey1':{'testkey2':{'testkey3':'testvalue'}}}, 'testurl');
				expect(model.get('testkey1')).toBeUndefined();
			});
			it('adds a BtappModel and clears state', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey1':{'testkey2':{'testkey3':'testvalue'}}}, null, 'testurl');
				var testkey1 = model.get('testkey1');
				expect(testkey1.get('testkey2')).toBeDefined();
				model.clearState();
				expect(testkey1.get('testkey2')).toBeUndefined();
			});
			it('adds a BtappCollection', function() {
				var model = new BtappModel({'id':'btapp'});
				model.updateState('testsession', {'torrent':{'all':{'01234':{'torrentname':'name'}}}}, null, 'btapp/');
				expect(model.get('torrent') instanceof BtappCollection).toBeTruthy();
			});
			it('adds a BtappCollection and ignores "all" when populating', function() {
				var model = new BtappModel({'id':'btapp'});
				model.updateState('testsession', {'torrent':{'all':{'01234':{'torrentname':'name'}}}}, null, 'testurl');
				var torrent = model.get('torrent').get('01234');
				expect(torrent instanceof BtappModel).toBeTruthy();
			});
		});
		describe('BtappCollection state updates', function() {
			it('throws an exception if not given a valid url', function() {
				var collection = new BtappCollection;
				var exception = 'cannot updateState with an invalid collection url';
				expect(function() { 
					collection.updateState('testsession', {'torrent':{'all':{'01234':{'torrentname':'name'}}}}, null, 'testurl'); 
				}).toThrow(exception);
			});
			it('adds models', function() {
				var collection = new BtappCollection;
				collection.updateState('testsession', {'key1':{'torrentname':'name1'},'key2':{'torrentname':'name1'}}, null, 'btapp/torrent/');
				expect(collection.length).toEqual(2);
				expect(collection.get('key1') instanceof BtappModel).toBeTruthy();
				expect(collection.get('key2') instanceof BtappModel).toBeTruthy();
			});
			it('adds a function', function() {
				var collection = new BtappCollection;
				collection.client = new LocalTorrentClient({'btapp':new BtappModel});
				collection.updateState('testsession', {'testfunc':'[nf]()'}, null, 'btapp/torrent/');
				expect(typeof collection.bt.testfunc).toEqual('function');
			});
			it('throws an exception if trying to add a non-BtappModel', function() {
				var collection = new BtappCollection;
				expect(function() { 
					collection.updateState('testsession', {'key1':'value1','key2':{}}, null, 'btapp/torrent/');
				}).toThrow('trying to add an invalid type to a BtappCollection');
			});
		});
		describe('RPC argument validation', function() {
			beforeEach(function() {
				this.model = new BtappModel({'id':'test'});
				this.model.client = new LocalTorrentClient({'btapp':this.model});
				this.model.updateState('testsession', {'testfunc':'[nf](string,dispatch)'}, null, 'testurl');
			});
			it('throws error if return callback not provided', function() {
				this.exception = 'return value callback is not optional';
				this.func = _.bind(this.model.bt.testfunc, this);
				expect(this.func).toThrow(this.exception);
			});
			it('throws error if return callback is not of type function', function() {
				this.exception = 'the first argument must be a function that receives the return value for the call to the client';
				this.func = _.bind(this.model.bt.testfunc, this, 'asdf');
				expect(this.func).toThrow(this.exception);
			});
			it('throws error if too many arguments are provided', function() {
				this.exception = 'arguments do not match any of the function signatures exposed by the client';
				this.func = _.bind(this.model.bt.testfunc, this, function() {}, 'arg1', function() {}, 'arg3');
				expect(this.func).toThrow(this.exception);
			});
			it('throws error if arguments are not of the correct type', function() {
				this.exception = 'arguments do not match any of the function signatures exposed by the client';
				this.func = _.bind(this.model.bt.testfunc, this, function() {}, 'arg1', 'arg2');
				expect(this.func).toThrow(this.exception);
			});
			it('throws error if the function signature exposed by the client contains non recognized types', function() {
				this.model.updateState('testsession', {'invalidfunc':'[nf](string,invalidtype)'}, null, 'testurl');
				this.exception = 'there is an invalid type in the function signature exposed by the client';
				this.func = _.bind(this.model.bt.invalidfunc, this, function() {}, 'arg1', 'arg2');
				expect(this.func).toThrow(this.exception);
			});
			it('does not throw error if arguments match the expected types', function() {
				this.func = _.bind(function() {
					this.model.bt.testfunc(function() {}, 'arg1', function() {});
					throw 'did not throw exception';
				}, this);
				expect(this.func).toThrow('did not throw exception');
			});
		});
		describe('BtappCollection events', function() {
			it('triggers add event', function() {
				var collection = new BtappCollection;
				var add_callback = jasmine.createSpy();
				collection.bind('add', add_callback);
				collection.updateState('testsession', {'all':{'ABCD':{'torrentname':'name'}}}, null, 'btapp/torrent/');
				expect(add_callback).toHaveBeenCalled();
			});
			it('triggers add:key event', function() {
				var collection = new BtappCollection;
				var add_callback = jasmine.createSpy();
				collection.bind('add:' + 'ABCD', add_callback);
				collection.updateState('testsession', {'all':{'ABCD':{'torrentname':'name'}}}, null, 'btapp/torrent/');
				expect(add_callback).toHaveBeenCalled();
			});
			it('triggers remove event', function() {
				var collection = new BtappCollection;
				var remove_callback = jasmine.createSpy();
				collection.bind('remove', remove_callback);
				collection.updateState('testsession', {'all':{'ABCD':{'torrentname':'name'}}}, null, 'btapp/torrent/');
				collection.updateState('testsession', null, {'all':{'ABCD':{'torrentname':'name'}}}, 'btapp/torrent/');
				expect(remove_callback).toHaveBeenCalled();
			});
			it('triggers remove:key event', function() {
				var collection = new BtappCollection;
				var remove_callback = jasmine.createSpy();
				collection.bind('remove:' + 'ABCD', remove_callback);
				collection.updateState('testsession', {'all':{'ABCD':{'torrentname':'name'}}}, null, 'btapp/torrent/');
				collection.updateState('testsession', null, {'all':{'ABCD':{'torrentname':'name'}}}, 'btapp/torrent/');
				expect(remove_callback).toHaveBeenCalled();
			});
			it('triggers change event when a model changes in the collection', function() {
				var collection = new BtappCollection;
				var change_callback = jasmine.createSpy();
				collection.bind('change', change_callback);
				collection.updateState('testsession', {'all':{'ABCD':{'key':'value'} } }, null, 'btapp/torrent/');
				collection.updateState('testsession', {'all':{'ABCD':{'key':'value2'} } }, {'all':{'ABCD':{'key':'value'} } }, 'btapp/torrent/');
				expect(change_callback).toHaveBeenCalled();
			});
			it('triggers change:key event when a model changes in the collection', function() {
				var collection = new BtappCollection;
				var change_callback = jasmine.createSpy();
				collection.bind('change:' + 'ABCD', change_callback);
				collection.updateState('testsession', {'all':{'ABCD':{'key':'value'} } }, null, 'btapp/torrent/');
				collection.updateState('testsession', {'all':{'ABCD':{'key':'value2'} } }, {'all':{'ABCD':{'key':'value'} } }, 'btapp/torrent/');
				expect(change_callback).toHaveBeenCalled();
			});
		});
		describe('BtappModel events', function() {
			it('triggers add event', function() {
				var model = new BtappModel({'id':'test'});
				var add_callback = jasmine.createSpy();
				model.bind('add', add_callback);
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(add_callback).toHaveBeenCalledWith('testkey', 'testvalue');
				model.unbind('add', add_callback);
			});
			it('triggers add:key event', function() {
				var model = new BtappModel({'id':'test'});
				var add_callback = jasmine.createSpy();
				model.bind('add:' + 'testkey', add_callback);
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(add_callback).toHaveBeenCalledWith('testvalue');
				model.unbind('add:' + 'testkey', add_callback);
			});
			it('triggers remove event', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				var remove_callback = jasmine.createSpy();
				model.bind('remove', remove_callback);
				model.updateState('testsession', null, {'testkey':'testvalue'}, 'testurl');
				expect(remove_callback).toHaveBeenCalledWith('testkey', 'testvalue');
				model.unbind('remove', remove_callback);
			});
			it('triggers remove:key event', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				var remove_callback = jasmine.createSpy();
				model.bind('remove:' + 'testkey', remove_callback);
				model.updateState('testsession', null, {'testkey':'testvalue'}, 'testurl');
				expect(remove_callback).toHaveBeenCalledWith('testvalue');
				model.unbind('remove:' + 'testkey', remove_callback);
			});
			it('triggers change event', function() {
				var model = new BtappModel({'id':'test'});
				var change_callback = jasmine.createSpy();
				model.bind('change', change_callback);
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(change_callback.callCount).toEqual(1);
				model.updateState('testsession', {'testkey':'newtestvalue'}, {'testkey':'testvalue'}, 'testurl');
				expect(change_callback.callCount).toEqual(2);
				model.updateState('testsession', null, {'testkey':'newtestvalue'}, 'testurl');
				expect(change_callback.callCount).toEqual(3);
				model.unbind('change', change_callback);
			});
			it('triggers change:key event', function() {
				var model = new BtappModel({'id':'test'});
				var change_callback = jasmine.createSpy();
				model.bind('change:' + 'testkey', change_callback);
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(change_callback.callCount).toEqual(1);
				model.updateState('testsession', {'testkey':'newtestvalue'}, {'testkey':'testvalue'}, 'testurl');
				expect(change_callback.callCount).toEqual(2);
				model.updateState('testsession', null, {'testkey':'newtestvalue'}, 'testurl');
				expect(change_callback.callCount).toEqual(3);
				model.unbind('change:' + 'testkey', change_callback);
			});
			it('triggers mimimum number of change events', function() {
				var settings1 = {"activate_on_file":"true","always_show_add_dialog":"false","anoninfo":"true","api_version":"1.2","append_incomplete":"false","ascon":0,"asdl":0,"asdns":0,"assz":0,"av_auto_update":"true","av_enabled":"true","avwindow":71024,"bind_port":57032};
				var settings2 = {"boss_key":0,"boss_key_salt":0,"bt.allow_same_ip":"false","bt.auto_dl_enable":"true","bt.auto_dl_factor":80,"bt.auto_dl_interval":120,"bt.auto_dl_qos_min":8500,"bt.auto_dl_sample_average":5,"bt.auto_dl_sample_window":15,"bt.ban_ratio":128,"bt.ban_threshold":3,"bt.compact_allocation":"false","bt.connect_speed":7,"bt.determine_encoded_rate_for_streamables":"true","bt.dl_queue_factor":4,"bt.dna_enabled":"true","bt.enable_pulse":"true","bt.enable_tracker":"false","bt.extra_ul_max":10,"bt.extra_ul_rand":128,"bt.failover_peer_speed_threshold":512,"bt.few_pieces_thres":4,"bt.graceful_shutdown":"true","bt.http_pending_limit":4,"bt.multiscrape":"true","bt.no_connect_to_services":"true","bt.no_connect_to_services_list":"25,80,110,443,6666,6667","bt.prio_first_last_piece":"false","bt.prio_piece_thres":20,"bt.prioritize_partial_pieces":"false","bt.pulse_interval":1200,"bt.pulse_weight":200,"bt.ratelimit_tcp_only":"false","bt.save_resume_rate":120,"bt.scrape_stopped":"false","bt.send_have_to_seed":"true","bt.sequential_download":"false","bt.sequential_files":"false","bt.set_sockbuf":"false","bt.shutdown_tracker_timeout":15,"bt.shutdown_upnp_timeout":5,"bt.tcp_rate_control":"true","bt.transp_disposition":31,"bt.ul_queue_factor":2,"bt.use_ban_ratio":"true","bt.use_rangeblock":"true","btapps.app_store":"http://apps.bittorrent.com/discoverContent/discoverContent.btapp","btapps.apps_channel":"http://pr.apps.bittorrent.com/share/share.btapp","btapps.auto_update_btapps":"true","btapps.auto_update_btinstalls":"true","btapps.enable_activex":"true","btapps.install_unsigned_apps":"true","cache.disable_win_read":"true","cache.disable_win_write":"true","cache.override":"false","cache.override_size":32,"cache.read":"true","cache.read_prune":"true","cache.read_thrash":"false","cache.read_turnoff":"true","cache.reduce":"true","cache.write":"true","cache.writeimm":"true","cache.writeout":"true","check_assoc_on_start":"true","check_update":"true","check_update_beta":"false","choker.interval":10,"choker.interval_auto":"true","choker.interval_optim":30,"clientname":"Torque","close_to_tray":"true","computer_id":"nxUh8besfdsR05aL","confirm_exit":"true","confirm_exit_critical_seeder":"true","confirm_remove_tracker":"true","conns_globally":200,"conns_per_torrent":50,"dht":"true","dht.collect_feed":"false","dht.rate":-1,"dht_per_torrent":"true","dir_active_download_flag":"false","dir_add_label":"false","dir_autoload_delete":"false","dir_autoload_flag":"false","dir_completed_download_flag":"false","dir_completed_torrents_flag":"false","dir_torrent_files_flag":"false","disable_fw":"true","diskio.cache_reduce_minutes":9,"diskio.cache_stripe":128,"diskio.coalesce_write_size":2097152,"diskio.coalesce_writes":"true","diskio.flush_files":"true","diskio.max_write_queue":32,"diskio.no_zero":"true","diskio.resume_min":100,"diskio.rsize_factor":16,"diskio.smart_hash":"true","diskio.smart_sparse_hash":"true","diskio.sparse_files":"false","diskio.use_partfile":"true","dna.server_prefix":"generator.dna.bittorrent.com/url?url=%s","dna_disable_screensaver":"true","dna_download_total":0,"dna_enable":1,"dna_notify":0,"dna_only":0,"dna_show_systray_icon":"true","dna_upload_limit":0,"dna_upload_total":0,"dont_confirm_when_deleting":"false","dw":138504305,"enable_scrape":"true","encryption_allow_legacy":"true","encryption_mode":0,"externalip":"216.171.54.24:0","fd":136,"gui.alternate_color":"false","gui.auto_restart":"true","gui.category_list_spaces":"true","gui.color_progress_bars":"true","gui.combine_listview_status_done":"true","gui.compat_diropen":"false","gui.default_del_action":0,"gui.delete_to_trash":"true","gui.dlrate_menu":"0,5,10,15,20,30,40,50,100,150,200,300,400,500","gui.enable_comments":"true","gui.enable_ratings":"true","gui.find_pane":"true","gui.granular_priority":"false","gui.graph_legend":"true","gui.graph_overhead":"true","gui.graph_tcp_rate_control":"false","gui.graphic_progress":"true","gui.limits_in_statusbar":"false","gui.log_date":"true","gui.manual_ratemenu":"false","gui.overhead_in_statusbar":"false","gui.piecebar_progress":"false","gui.report_problems":"true","gui.show_av_icon":"false","gui.show_devices":"true","gui.show_notorrents_node":"false","gui.show_player_node":"false","gui.show_plus_av_upsell":"true","gui.show_plus_conv_upsell":"true","gui.show_plus_upsell":"true","gui.show_rss_favicons":"true","gui.show_status_icon_in_dl_list":"false","gui.show_welcome_node":"false","gui.speed_in_title":"false","gui.tall_category_list":"true","gui.toolbar_labels":"false","gui.transparent_graph_legend":"false","gui.ulrate_menu":"0,5,10,15,20,30,40,50,100,150,200,300,400,500","gui.update_rate":1000,"gui.use_fuzzy_dates":"true","gui.wide_toolbar":"false","initial_install_version":0,"install_modification_time":0,"install_revision":25802,"ipfilter.enable":"true","is_plus_active":"true","isp.bep22":"true","isp.peer_policy_enable":"true","isp.peer_policy_expy":1329811391,"isp.peer_policy_override":"false","isp.primary_dns":"208.67.222.222","isp.secondary_dns":"208.67.220.220","language":-1,"limit_dna_upload":"false","logger.log_upnp_to_file":"false","logger_mask_debug":3801152,"lsd":"true","mainwnd_split":172,"mainwnd_split_x":150,"mainwndstatus":0,"max_active_downloads":5,"max_active_torrent":8,"max_dl_rate":0,"max_ul_rate":0,"max_ul_rate_seed":0,"max_ul_rate_seed_flag":"false","minified":"true","minimize_to_tray":"false","move_if_defdir":"true","multi_day_transfer_limit_en":"false","multi_day_transfer_limit_span":11,"multi_day_transfer_limit_unit":1,"multi_day_transfer_limit_value":200,"multi_day_transfer_mode_dl":"false","multi_day_transfer_mode_ul":"false","multi_day_transfer_mode_uldl":"true","natpmp":"true","net.calc_overhead":"false","net.calc_rss_overhead":"true","net.calc_tracker_overhead":"true","net.diffserv_codepoint":-1,"net.disable_incoming_ipv6":"false","net.discoverable":"true","net.limit_excludeslocal":"false","net.low_cpu":"false","net.max_halfopen":100,"net.outgoing_max_port":0,"net.outgoing_port":0,"net.ratelimit_utp":"true","net.upnp_tcp_only":"false","net.utp_dynamic_packet_size":"true","net.utp_initial_packet_size":4,"net.utp_packet_size_interval":10,"net.utp_receive_target_delay":100,"net.utp_target_delay":100,"no_local_dns":"false","notify_complete":"true","only_proxied_conns":"false","peer.disconnect_inactive":"true","peer.disconnect_inactive_interval":300,"peer.lazy_bitfield":"true","peer.lazy_bitfield_factor":24,"peer.lazy_bitfield_mode":0,"peer.lazy_bitfield_nohave":0,"peer.resolve_country":"false","pex":"true","plus_expiry":1354924463,"plus_license":"5e2a52db35170f98","plus_player_installed":"false","prealloc_space":"false","private_ip":"false","proxy.auth":"false","proxy.p2p":"false","proxy.port":8080,"proxy.resolve":"false","proxy.type":0,"queue.dont_count_slow_dl":"true","queue.dont_count_slow_ul":"true","queue.prio_no_seeds":"true","queue.slow_dl_threshold":1000,"queue.slow_ul_threshold":1000,"queue.started_bonus":0,"queue.switchtime":60,"queue.switchtime_prio":300,"queue.use_seed_peer_ratio":"true","rand_port_on_start":"false","rate_limit_local_peers":"false","remote_client_id":"3980487167","remove_torrent_files_with_private_data":"true","resolve_peerips":"true","resume.dir_only":"false","resume.enable_resume_dir":"false","revision":"25802","rss.feed_as_default_label":"true","rss.smart_repack_filter":"true","rss.update_interval":15,"s_url":"https://www.surveymonkey.com/s/YT98YYN","sched_dis_dht":"true","sched_dl_rate":0,"sched_enable":"false","sched_interaction":"false","sched_ul_rate":0,"sdur":345600,"search_list":"BitTorrent|http://www.bittorrent.com/search?client=%v&search=\r\nMininova|http://www.mininova.org/search/?cat=0&search=","search_list_sel":0,"seed_num":0,"seed_prio_limitul":4,"seed_prio_limitul_flag":"false","seed_ratio":1500,"seed_time":0,"seeds_prioritized":"false","settings_saved_systime":1329807791,"show_add_dialog":"true","show_category":"true","show_details":"true","show_files_tab":"true","show_general_tab":"true","show_logger_tab":"false","show_peers_tab":"true","show_pieces_tab":"false","show_pulse_tab":"true","show_speed_tab":"true","show_status":"true","show_tabicons":"true","show_toolbar":"true","show_tracker_tab":"true","sid1":4,"sid2":0,"sid3":0,"sid4":0,"sid5":0,"silent_auto_updates":"false","smaxage":31536000,"sminage":1209600,"smode":3,"ssamper":1000,"start_minimized":"true","stats.video1.finished":"false","stats.video1.time_watched":0,"stats.video2.finished":"false","stats.video2.time_watched":0,"stats.video3.finished":"false","stats.video3.time_watched":0,"stats.welcome_page_useful":0,"stitle":"Take our feedback survey","store_torr_infohash":"false","streaming.failover_rate_factor":200,"streaming.failover_set_percentage":70,"streaming.min_buffer_piece":5,"streaming.preview_player":"uTorrent Player","streaming.safety_factor":110,"sys.enable_wine_hacks":"true","sys.prevent_standby":"true","td":36303344,"torrents_start_stopped":"false","tray.show":"true","tray.single_click":"false","tray_activate":"true","tu":31179630,"ul_rate_download_thres":0,"ul_slots_per_torrent":4,"upnp":"true","upnp.external_tcp_port":0,"upnp.external_udp_port":0,"use_boss_key_pw":"false","use_udp_trackers":"true","v":138634442,"webui.allow_pairing":"true","webui.cookie":"{}","webui.enable":0,"webui.enable_guest":0,"webui.enable_listen":0,"webui.guest":"guest","webui.port":8080,"webui.raptor_host":"raptor.utorrent.com","webui.raptor_port":443,"webui.raptor_secure":"true","webui.remote_enable":"true","webui.talon_host":"remote.utorrent.com","webui.talon_port":80,"webui.talon_secure":"false","webui.token_auth":"true","webui.uconnect_actions_count":0,"webui.uconnect_actions_list_count":0,"webui.uconnect_connected_ever":"false","webui.uconnect_enable":"false","webui.uconnect_enable_ever":"false","webui.uconnect_password":"***********","webui.uconnect_question_opted_out":"false","webui.uconnect_srp_required":"true","webui.uconnect_toolbar_ever":"false","webui.username":"admin"};
				var model = new BtappModel({'id':'settings'});
				var change_callback = jasmine.createSpy();
				model.bind('change', change_callback);
				model.updateState('testsession', settings1, null, 'testurl');
				model.updateState('testsession', settings2, settings1, 'testurl');
				model.updateState('testsession', null, settings2, 'testurl');
				expect(change_callback.callCount).toEqual(4);
			});
		});
	});
}).call(this);