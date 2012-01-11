function assert(condition) { if(!condition) debugger; }
var MAX_PEERS = 24.0;
var QUERIES = [
	'btapp/torrent/all/*/file/all/*/properties/all/name/',
	'btapp/torrent/all/*/file/all/*/properties/all/downloaded/',
	'btapp/torrent/all/*/file/all/*/properties/all/size/',
	'btapp/torrent/all/*/properties/all/download_url/',
	'btapp/torrent/all/*/properties/all/uri/',
	'btapp/add/torrent/'
];

$(function() {
	window.FileBubble = Backbone.View.extend({
		initialize: function() {
			//console.log('Created a FileBubble');
			_.bindAll(this, 'destructor', 'render');
			this.model.get('properties').bind('change', this.render);
		},
		destructor: function() {
			$(this.el).empty().remove();
			//console.log('Destructing a FileBubble');
		},
		render: function() {
			$(this.el).empty();
			$(this.el).append($('<a href="#">' + this.model.get('properties').get('name') + '</a>'));
			return this;
		}
	});
	window.TorrentBubble = Backbone.View.extend({
		initialize: function() {
			//console.log('Created a TorrentBubble');
			_.bindAll(this, 'render', 'destructor', 'file_added', 'file_removed', 'files_added', 'files_removed');
			this.model.bind('add:file', this.files_added);
			this.model.bind('remove:file', this.files_removed);
			if(this.model.get('file')) {
				this.files_added();
			}
		},
		destructor: function() {
			this.model.unbind('add:file', this.files_added);
			this.model.unbind('remove:file', this.files_removed);
			if(this.model.get('file')) {
				this.model.get('file').unbind('add', this.file_added);
				this.model.get('file').unbind('remove', this.file_removed);
			}
			$(this.el).empty().remove();
			//console.log('Destructing a TorrentBubble');
		},
		file_added: function(file) {
			file.bind('destroy', _.bind(function(file) { this.file_removed(file); }, this, file));
			assert(!(file.cid in this.file_views));
			this.file_views[file.cid] = new FileBubble({'model':file});
			this.file_views[file.cid].torrent = this.model;
		},
		file_removed: function(file) {
			assert(file.cid in this.file_views);
			this.file_views[file.cid].destructor();
			this.file_views[file.cid].remove();
			delete this.file_views[file.cid];
		},
		files_added: function() {
			this.file_views = {};
			this.model.get('file').bind('add', this.file_added);
			this.model.get('file').bind('remove', this.file_removed);
			this.model.get('file').each(this.file_added);
		},
		files_removed: function() {
			assert(_.keys(this.file_views).length == 0);
			this.file_views = null;
		},
		render: function() {
			$(this.el).empty();
			$(this.el).draggable({
				scope: 'files',
				helper: 'clone',
				revert: 'invalid',
				zIndex: 9999,
				start: _.bind(function(event,ui) {
					$(this.el).data('injected', this)
				}, this)
			});

			if(this.file_views) {
				var _this = this;
				_.each(this.file_views, function(val, key) {
					$(_this.el).append(val.render().el);
				});
			}
			$(this.el).append($('<br>'));
			return this;
		}
	});
	window.UserCollectionBubble = Backbone.View.extend({
		initialize: function() {
			//console.log('Created a UserCollectionBubble');
			_.bindAll(this, 'render', 'torrent_added', 'torrent_removed', 'torrents_added', 'torrents_removed', 'destructor');
			this.model.bind('add:torrent', this.torrents_added);
			this.model.bind('remove:torrent', this.torrents_removed);
			if(this.model.get('torrent'))
				this.torrents_added();
			this.model.bind('hide', _.bind(function() {
				$(this.el).hide();
			}, this));
			this.model.bind('show', _.bind(function() {
				$(this.el).fadeIn(100);
			}, this));
			this.model.bind('destroy', this.destructor);
		},
		destructor: function() {
			this.model.unbind('add:torrent', this.torrents_added);
			this.model.unbind('remove:torrent', this.torrents_removed);
			if(this.model.get('torrent')) {
				this.model.get('torrent').bind('add', this.torrent_added);
				this.model.get('torrent').bind('remove', this.torrent_removed);
			}
			$(this.el).empty().remove();
			//console.log('Destructing a UserCollectionBubble');
		},
		torrent_added: function(torrent) {
			assert(!(torrent.cid in this.torrent_views));
			torrent.bind('destroy', _.bind(function(torrent) { this.torrent_removed(torrent); }, this, torrent));
			this.torrent_views[torrent.cid] = new TorrentBubble({'model':torrent});
			$(this.el).append($(this.torrent_views[torrent.cid].render().el));
		},
		torrent_removed: function(torrent) {
			assert(torrent.cid in this.torrent_views);
			this.torrent_views[torrent.cid].destructor();
			this.torrent_views[torrent.cid].remove();
			delete this.torrent_views[torrent.cid];
		},
		torrents_added: function() {
			this.torrent_views = {};
			this.model.get('torrent').bind('add', this.torrent_added);
			this.model.get('torrent').bind('remove', this.torrent_removed);
			this.model.get('torrent').each(this.torrent_added);
		},
		torrents_removed: function() {
			assert(_.keys(this.torrent_views).length == 0);
			this.torrent_views = null;
		},
		render: function() {
			$(this.el).empty();
			if(this.torrent_views) {
				var _this = this;
				_.each(this.torrent_views, function(val, key) {
					$(_this.el).append(val.render().el);
				});
			}
			return this;
		}
	});
	window.UserBubble = Backbone.View.extend({
		className: 'userbubble',
		initialize: function() {
			//console.log('Created a UserBubble');
			_.bindAll(this, 'render', 'destructor', 'set_position', 'change_position', 'onclick', 'onhover', 'ondrop');
			this.model.bind('hide', _.bind(function() {
				$(this.el).removeClass('selected');
			}, this));
			this.model.bind('show', _.bind(function() {
				$(this.el).addClass('selected');
			}, this));
			this.model.bind('add:torrent', this.render);
			this.model.bind('remove:torrent', this.render);
			this.model.bind('position', this.change_position);
			this.model.bind('destroy', this.destructor);
			this.set_position(this.options.position);
		},
		destructor: function() {
			$(this.el).empty().remove();
			//console.log('Destructing a UserBubble');
		},
		onclick: function() {
			window.bubbles.each(function(bubble) { bubble.trigger('hide'); });
			this.model.trigger('show');
		},
		onhover: function() {
			$(this.el).draggable({ 
				'revert': 'invalid', 
				'scope': 'users',
				'start': _.bind(function(event,ui) {
					$(this.el).data('injected', this.model);
				}, this)
			});
		},
		ondrop: function(event, ui) {
			var injected = $(ui.draggable).data('injected');
			var uri = injected.model.get('properties').get('uri');
			this.model.get('add').bt.torrent(function() {}, uri);
		},
		render: function() {
			$(this.el).empty();
			var name = this.model.client.username ? this.model.client.username : 'You';
			$(this.el).append(
				$('<div><a href="#">' + name + '</a></div>').append(
					$('<img src="' + (this.model.get('torrent') ? 'img/connected.png' : 'img/disconnected.png') + '" />')
				)
			);
			$(this.el).click(this.onclick);
			$(this.el).hover(this.onhover);
			$(this.el).droppable({
				tolerance: 'pointer',
				activeClass: 'dropzoneEnabled',
				hoverClass: 'dropzoneDroppable',
				drop: this.ondrop,
				scope: 'files'
			});
			return this;
		},
		set_position: function(position) {
			var x = 330 + Math.cos((1.0 * position / MAX_PEERS - 1.0/4.0) * 2.0 * Math.PI) * 290;
			var y = 330 + Math.sin((1.0 * position / MAX_PEERS - 1.0/4.0) * 2.0 * Math.PI) * 290;
			$(this.el).css('left', x + 'px');
			$(this.el).css('top', y + 'px');
		},
		change_position: function(position) {
			var x = 330 + Math.cos((1.0 * position / MAX_PEERS - 1.0/4.0) * 2.0 * Math.PI) * 290;
			var y = 330 + Math.sin((1.0 * position / MAX_PEERS - 1.0/4.0) * 2.0 * Math.PI) * 290;
			$(this.el).animate({'left': x + 'px', 'top': y + 'px'}, {'complete': function() {}});
		}
	});

	window.bubbles = new Backbone.Collection;
	window.bubbles.bind('remove', function(btapp) {
		
	});
	window.bubbles.bind('add', function(btapp) {
		if(window.bubbles.size() > MAX_PEERS) return;
		var position = window.bubbles.size() - 1;
		var collection = new UserCollectionBubble({'model':btapp});
		btapp.trigger('hide');
		$('#files_list').append($(collection.render().el));
		//console.log('Adding a user bubble at position ' + position);
		var view = new UserBubble({'model':btapp,'position':position});
		$('#bubbles').append($(view.render().el));
	});
/**	
	$('body').droppable({
		tolerance: 'pointer',
		activeClass: 'dropzoneEnabled',
		hoverClass: 'dropzoneDroppable',
		drop: function(event, ui) {
			var model = $(ui.draggable).data('injected');
			window.bubbles.remove(model);
			model.trigger('destroy');
		},
		scope: 'users'
	});
**/
	$('#userform').submit(function(ev) {
		ev.preventDefault();
		var username = $('#username').val();
		var password = $('#password').val();
		if(username && username != '' && password && password != '') {
			window.bubbles.add(new Btapp({'username':username,'password':password,'queries':QUERIES,'poll_frequency':3000}));
		} else {
			window.bubbles.add(new Btapp({'queries':QUERIES,'poll_frequency':3000}));
		}
	});
	
	//lets start off by adding the local computer
	var localhost = new Btapp({'id':'btapp','queries':QUERIES,'poll_frequency':3000});
	window.bubbles.add(localhost);
	localhost.trigger('show');
});