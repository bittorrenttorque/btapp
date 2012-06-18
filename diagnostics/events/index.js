jQuery(function() {
    window.btapp = new Btapp;
    btapp.bind('all', function(eventname, options) {
	console.log(eventname, options);
	//if(options) console.log('             ' + JSON.stringify(options));
    });
    btapp.connect( { plugin_ajax: true, pairing_type: 'native', product: 'uTorrent', queries:['btapp/torrent/all/*/properties/','btapp/create_remote_account/','btapp/browseforfiles/' ] });
});
