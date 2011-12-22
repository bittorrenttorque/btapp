$(function() {
	window.btappview = new window.BtappView({'model':new Btapp({'username':'username','password':'password'}), 'el':'body'});
	window.btappview.render();
	
	window.btappview.model.bind('add:add', _.bind(function() {
		var link = 'http://www.clearbits.net/get/1684-captive---bittorrent-edition.torrent';
		var func = this.get('add').bt['torrent'];
		func(function() { }, link);
	}, window.btappview.model));
});