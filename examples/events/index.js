jQuery(function() {
	window.btapp = new Btapp;
	btapp.bind('all', function(eventname, options) {
		console.log(eventname);
		if(options) console.log('             ' + JSON.stringify(options));
	});
	btapp.connect();
});