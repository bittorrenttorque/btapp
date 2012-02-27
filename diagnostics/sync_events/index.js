function print(data, prefix) {
	prefix = prefix || '';
	for(d in data) {
		if(typeof data[d] === 'object') {
			console.log(prefix + d);
			print(data[d], prefix + '    ');
		} else {
			console.log(prefix + d + ': ' + data[d]);
		}
	}
}

jQuery(function() {
	window.btapp = new Btapp;
	btapp.bind('sync', function(data) {
		console.log('---- BEGIN SYNC ----');
		console.log(data);
		print(data);
		console.log('---- FINISH SYNC ----');
		console.log('');
		console.log('');
	});
	btapp.connect();
});