# backbone.btapp.js #
An extension built on Backbone.js that keeps an up-to-date representation of your uTorrent client's state/torrents/etc

You can simply write

    var btapp = new Btapp;
	btapp.get('torrent').each(function(torrent) {
		console.log(torrent.get('properties').get('hash'));
	});

