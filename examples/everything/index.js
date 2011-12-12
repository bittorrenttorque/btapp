$(function() {
	window.FileView = Backbone.View.extend({
		initialize: function() {
			_.bindAll(this, 'render', 'destroy', 'properties_change');
			this.model.bind('change', this.render);
			if(this.model.get('properties')) {
				this.model.get('properties').bind('change', this.render);
			} else {
				this.model.bind('change:properties', this.properties_change);
			}
		},
		properties_change: function() {
			if(this.model.get('properties') && !this.model.previous('properties')) {
				this.model.get('properties').bind('change', this.render);
			}
		},
		render: function() {
			if(!this.model) return this;
			
			try {
				$(this.el).empty();
				var d = $('<div>' + this.model.id + ' - <font color="red">' + (100.0 * this.model.get('properties').get('downloaded') / this.model.get('properties').get('size')) + '</font></div>');
				$(this.el).append(d);
				
				for(var f in this.model.bt) {
					var button = $('<button type="button">' + f + '</button>');
					button.click(_.bind(function(func) { 
						func(); 
					}, this, this.model.bt[f]));
					d.append(button);
				}
			} catch(err) {}
			return this;
		},
		destroy: function() {
			$(this.el).empty();
			$(this.el).remove();
		}	
	});

	window.TorrentView = Backbone.View.extend({
		initialize: function() {
			_.bindAll(this, 'render', 'add_file', 'remove_file', 'destroy', 'properties_change');
			this.model.bind('change', this.render);
			this.model.bind('add:file', _.bind(function() {
				this.files = [];
				this.model.get('file').each(this.add_file);
				//bind to the add/remove of the collection
				this.model.get('file').bind('add', this.add_file);				
				this.model.get('file').bind('remove', this.remove_file);
			}, this));
			this.model.bind('remove:file', _.bind(function() {
				_.each(this.files, function(view) {
					view.destroy();
				});
				
				this.files = null;
			}, this));
			
			this.files = null;
			var existing = this.model.get('file');
			if(existing) existing.each(this.file);

			if(this.model.get('properties')) {
				this.model.get('properties').bind('change', this.render);
			} else {
				this.model.bind('change:properties', this.properties_change);
			}
		},
		properties_change: function() {
			if(this.model.get('properties') && !this.model.previous('properties')) {
				this.model.get('properties').bind('change', this.render);
			}
		},
		add_file: function(file) {
			var view = new FileView({'model':file});
			this.files.push(view);
			$(this.el).append(view.render().el);
		},
		remove_file: function(file) {
			//iterate over list of files and remove 
			//the view that corresponds to the file
			for(t in this.files) {
				var view = this.files[t];
				if(view.model.id == file.id) {
					this.files[t].destroy();
					delete this.files[t];
					break;
				}
			}
		},
		render: function() {
			if(!this.model) return this;

			$(this.el).empty();
			var name = this.model.get('properties') ? this.model.get('properties').get('name') : this.model.id;
			var started = this.model.get('properties') ? this.model.get('properties').get('status') == 201 : false;
			var d = $('<div><font color=\"' + (started ? 'green' : 'red') + '\">' + name + '</font></div>');
			$(this.el).append(d);
			
			for(var f in this.model.bt) {
				var button = $('<button type="button">' + f + '</button>');
				button.click(_.bind(function(func) { 
					func(); 
				}, this, this.model.bt[f]));
				d.append(button);
			}
			
			for(var t in this.files) {
				var view = this.files[t];
				$(this.el).append(view.render().el);
			}
			return this;
		},
		destroy: function() {
			_.each(this.files, this.remove_file);
			$(this.el).empty();
			$(this.el).remove();
		}
	});

	window.BtappView = Backbone.View.extend({
		initialize: function() {
			_.bindAll(this, 'render', 'add_torrent', 'remove_torrent', 'destroy');
			this.model.bind('change', this.render);
			this.model.bind('add:torrent', _.bind(function() {
				this.torrents = [];
				this.model.get('torrent').each(this.add_torrent);
				this.model.get('torrent').bind('add', this.add_torrent);				
				this.model.get('torrent').bind('remove', this.remove_torrent);
			}, this));
			this.model.bind('remove:torrent', _.bind(function() {
				_.each(this.torrents, function(view) {
					view.destroy();
				});
				
				this.torrents = null;
			}, this));
			
			this.torrents = null;
		},
		add_torrent: function(torrent) {
			var view = new TorrentView({'model':torrent});
			this.torrents.push(view);
			$(this.el).append(view.render().el);
		},
		remove_torrent: function(torrent) {
			//iterate over list of torrents and remove 
			//the view that corresponds to the torrent
			for(t in this.torrents) {
				var view = this.torrents[t];
				if(view.model.id == torrent.id) {
					this.torrents[t].destroy();
					delete this.torrents[t];
					break;
				}
			}
		},
		render: function() {
			$(this.el).empty();
			$(this.el).append('<h1>Crysalis</h1>');
			for(var t in this.torrents) {
				var view = this.torrents[t];
				$(this.el).append(view.render().el);
			}
			return this;
		},
		destroy: function() {
			_.each(this.torrents, this.remove_torrent);
			$(this.el).empty();
			$(this.el).remove();
		}
	});
	
	window.btappview = new window.BtappView({'model':new Btapp({'host':'10.10.90.166','port':'22907'}), 'el':'body'});
	window.btappview.render();
	
	window.btappview.model.bind('add:add', _.bind(function() {
		var link = 'http://www.clearbits.net/get/1684-captive---bittorrent-edition.torrent';
		var func = this.get('add').bt['torrent'];
		func(function() { }, link);
	}, window.btappview.model));
});