window.FileView = Backbone.View.extend({
	tagName: 'li',
	initialize: function() {
		_.bindAll(this, 'render');
		this.bind('change', this.render);
	},
	render: function() {
		$(this.el).empty();
		$(this.el).append(this.model.get('properties').get('name'));
		return this;
	}
});


window.TorrentView = Backbone.View.extend({
	initialize: function() {
		_.bindAll(this, 'render');
		this.bind('change', this.render);
	},
	render: function() {
		$(this.el).empty();
		$(this.el).append('<b>' + this.model.get('properties').get('name') + '</b>');
		var status = this.model.get('properties').get('status');
		var started = (status % 2 === 1);
		if(started) {
			$(this.el).append('<input type="button" value="stop"></input>');
		} else {
			$(this.el).append('<input type="button" value="start"></input>');
		}
		$(this.el).append('<input type="button" value="remove"></input>');
		$(this.el).append('<ul id="' + this.model.id + '" class="files"></ul>');
		return this;
	}
});

window.CreationView = Backbone.View.extend({
	initialize: function() {
		_.bindAll(this, 'render');
	},
	render: function() {
		$(this.el).empty();
		$(this.el).append('<input type="text" id="torrent_link" />');
		var add = $('<input type="button" value="add"></input>');
		add.click(function() {
			btapp.get('add').torrent($('#torrent_link').val());
		});
		$(this.el).append(add);
		$(this.el).append('<font style="color:white;">...</font>');
		var create = $('<input type="button" value="create"></input>');
		create.click(function() {
			btapp.browseforfiles(function(files) {
				btapp.create('', _.values(files), function() {});
			});
		});
		$(this.el).append(create);
		return this;
	}
});

jQuery(function() {
	window.btapp = new Btapp;
	btapp.connect();
	var torrent_views = {};
	var listener = new BtappListener({'btapp':btapp});
	listener.bind(Btapp.QUERIES.TORRENTS, function(torrent) {
		torrent_views[torrent.id] = new TorrentView({'model':torrent});
		$('#torrents').append(torrent_views[torrent.id].render().el);
	});
	listener.bind(Btapp.QUERIES.FILES, function(file) {
		$('#' + file.get('torrent')).append(new FileView({'model':file}).render().el);
	});
	
	$('#creation').append((new CreationView).render().el);
});