function print(data, prefix) {
	prefix = prefix || '';
	var num_attributes = 0;
	for(d in data) {
		if(typeof data[d] === 'object') {
			console.log(prefix + d);
			print(data[d], prefix + '    ');
		} else {
			num_attributes++;
		}
	}
	console.log(prefix + num_attributes + ' non-object attributes');
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