$(function() {
	function appendData(data, element) {
			switch(typeof data) {
				case 'function':
				case 'string':
				case 'number':
					element.append($('<div style="padding-left:30px; font-size:1em;">' + data + '</div>'));
					break;
				case 'object':
					for(d in data) {
						var child = $('<div style="padding-left:30px; font-size:1em;">' + d + '</div>');
						element.append(child);
						appendData(data[d], child);
					}
					break;
				break;
				default:
				debugger;
				break;
			}
	}

	window.BtappView = Backbone.View.extend({
		initialize: function() {
			this.data = {};
			_.bindAll(this, 'onEvent');
			this.model.bind('event', this.onEvent);		
		},
		onEvent: function(data) {
			this.data = data;
			this.render();
		},
		render: function() {
			$('#add').empty();
			if(this.data.add)
				appendData(this.data.add, $('#add'));
			$('#remove').empty();
			if(this.data.remove)
				appendData(this.data.remove, $('#remove'));
			return this;
		}
	});
});