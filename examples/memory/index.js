function dump_memory(cb) {
	if('bt' in btapp) {
		if('dump_memory' in btapp.bt) {
			btapp.bt['dump_memory'](cb);
			return;
		}
	}
	cb({});
}

function display_counts() {
	dump_memory(function(data) {
		var mem = {};
		if(typeof data === 'object' && 'btapp' in data && 'dump_memory' in data.btapp) {
			mem = data.btapp.dump_memory;
		}
		var entries = [];
		for(var l in mem) {
			entries.push({allocations:mem[l].allocations,memory:mem[l].size,line:l});
		}
		entries.sort(function(a,b) {
			return b.allocations-a.allocations;
		});

		$('#holder').empty();
		for(var e in entries) {
			var entry = entries[e];
			$('#holder').append('<div>' + entry.line + ' -> ' + entry.allocations + '/' + entry.memory + '</div>');
		}
	});
}

$(document).ready(function() {
	window.btapp = new Btapp;
	setInterval(display_counts, 5000);
	btapp.bind('add:torrent', function() {
		display_counts();
	});
	
});

