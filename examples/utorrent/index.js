jQuery(function() {
	window.btapp = new Btapp;
	btapp.on('plugin:run_client', function(options) {
		options.run = false;
	});

	btapp.on('plugin:install_client', function(options) {
		options.install = false;
	});

	btapp.on('plugin:check_for_running_client', function(options) {
		options.check = true;
	});

	btapp.on('all', _.bind(console.log, console));

	btapp.connect({
		product: 'uTorrent'
	});
});