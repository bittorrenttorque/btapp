jQuery(function() {
	window.btapp = new Btapp;
	btapp.bind('add:settings', function() {
		console.log('add:settings');
		btapp.get('settings').bind('change', function(attribute) {
			console.log(JSON.stringify(attribute));
		});
	});
	btapp.connect();
});