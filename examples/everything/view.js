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
			if(existing) {
				this.files = [];
				existing.each(this.add_file);
			}

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
			
			for(var i = 0; this.files && i < this.files.length; i++) {
				var view = this.files[i];
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
			for(var i = 0; this.torrents && i < this.torrents.length; i++) {
				var view = this.torrents[i];
				if(view.model.id == torrent.id) {
					this.torrents[i].destroy();
					delete this.torrents[i];
					break;
				}
			}
		},
		render: function() {
			$(this.el).empty();
			$(this.el).append('<h1>Crysalis</h1>');
			if(this.torrents) {
				for(var i = 0; this.torrents && i < this.torrents.length; i++) {
					var view = this.torrents[i];
					$(this.el).append(view.render().el);
				}
			}
			return this;
		},
		destroy: function() {
			_.each(this.torrents, this.remove_torrent);
			$(this.el).empty();
			$(this.el).remove();
		}
	});
});