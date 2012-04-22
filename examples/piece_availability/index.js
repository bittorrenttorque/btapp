window.TorrentView = Backbone.View.extend({
	initialize: function() {
		_.bindAll(this, 'render', 'receive_availability', 'receive_pieces');
	
		var INTERVAL = 2000;
		
		this.availability_interval = setInterval(_.bind(function() {
			this.model.availability().then(this.receive_availability);
		}, this), INTERVAL);
		this.pieces_interval = setInterval(_.bind(function() {
			this.model.pieces().then(this.receive_pieces);
		}, this), INTERVAL);
		this.model.bind('destroy', _.bind(function() { 
			clearInterval(this.availability_interval); 
			clearInterval(this.pieces_interval); 
			this.remove(); 
		}, this));
	},
	receive_availability: function(data) { 
		this.availability = data.btapp.torrent.all[this.model.id].availability;
		this.render(); 
	}, 
	receive_pieces: function(data) {
		this.pieces = data.btapp.torrent.all[this.model.id].pieces;
		this.render();
	},
	render: function() {
		$(this.el).empty();
		$(this.el).append('<div>' + this.model.get('properties').get('name') + '</div>');
		if(this.availability) {
			$(this.el).append('<div>' + this.availability + '</div>');
		}
		if(this.pieces) {
			$(this.el).append('<div>' + this.pieces + '</div>');
		}
		return this;
	}
});

jQuery(function() {
	var btapp = new Btapp;
	btapp.connect({queries: Btapp.QUERIES.TORRENTS});
	
	var listener = new BtappListener({'btapp':btapp});
	listener.bind(Btapp.QUERIES.TORRENTS, function(torrent) {
		$('body').append((new TorrentView({'model':torrent})).render().el);
	});
});