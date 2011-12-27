function dump_memory(cb) {
	if('bt' in btapp) {
		if('dump_memory' in btapp.bt) {
			btapp.bt['dump_memory'](cb);
			return;
		}
	}
	cb({});
}

function display_counts(mem) {
	var entries = [];
	for(var l in mem) {
		entries.push({allocations:mem[l].allocations,memory:mem[l].size,line:l});
	}
	entries.sort(function(a,b) {
		return b.allocations-a.allocations;
	});

	$('body').empty();
	for(var e in entries) {
		var entry = entries[e];
		$('body').append('<div>' + entry.line + ' -> ' + entry.allocations + '/' + entry.memory + '</div>');
	}
}

$(document).ready(function() {
	window.client = new LocalTorrentClient;
	window.client.bind('ready', function() {
		window.client.query('state', ['btapp/dump_memory/'], null, 
			function(data) {
				window.client.query('function', ['btapp/dump_memory(' + $.toJSON([]) + ')'], data.session, 
					function(data) {
						display_counts(data.btapp.dump_memory);
					},
					function(data) {
						debugger;
					}
				);
			}, 
			function(data) {
				debugger;
			}
		);
	});
});

