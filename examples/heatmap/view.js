function get_darker_color(color) {
    var colorInt = parseInt(color.substring(1),16);

    var R = (colorInt & 0xFF0000) >> 16;
    var G = (colorInt & 0x00FF00) >> 8;
    var B = (colorInt & 0x0000FF) >> 0;

    R = Math.floor(R / 1.01);
    G = Math.floor(G / 1.03);
    B = Math.floor(B / 1.03);

    var newColorInt = (R<<16) + (G<<8) + (B);
    var newColorStr = "#"+newColorInt.toString(16);

    return newColorStr;
}

$(function() {
	$('body').css('font-size', '2em');
	window.BtappView = Backbone.View.extend({
		initialize: function() {
			this.color = get_darker_color(get_darker_color('#ffffff'));
			this.views = {};
			_.bindAll(this, 'render', 'add', 'remove');
			this.model.bind('change', this.render);
			if('length' in this.model) {
				this.model.bind('add', this.add);
				this.model.bind('remove', this.remove);
				this.model.each(this.add);
			} else {
				this.model.bind('add', _.bind(function(attr) {
					_.each(this.model.changedAttributes(), this.add);
				}, this));
				this.model.bind('remove', _.bind(function(attr) {
					this.remove(attr);
				}, this));
				_.each(this.model.attributes, this.add);
			}
		},
		add: function(attr) {
			if(typeof attr === 'object' && 'updateState' in attr) {
				this.views[attr.cid] = new BtappView({'model':attr});
				attr.bind('change', this.render);
				this.trigger('change');
			}
		},
		remove: function(attr) {
			if(typeof attr === 'object' && 'updateState' in attr) {
				$(this.views[attr.cid].el).empty().remove();
				delete this.views[attr.cid];
				this.trigger('change');
			}
		},
		render: function() {
			this.color = get_darker_color(this.color);
			$(this.el).empty();
			var title = $('<div><font color="' + this.color + '">' + this.model.url + '</font></div>');
			var attributes = $('<div><font color="' + this.color + '"></font></div>');
			attributes.css('margin-left', '30px');
			attributes.css('font-size', '0.8em');
			if(!('length' in this.model)) {
				_.each(this.model.attributes, _.bind(function(value, key) {
					if(typeof value === 'object' && 'updateState' in value) return;
					attributes.append('<div><font color="' + this.color + '">' + key + ' - ' + $.toJSON(value) + '</font></div>');
				}, this));
			}
			var children = $('<div></div>');
			children.css('margin-left', '60px');
			children.css('font-size', '0.8em');
			for(var v in this.views) children.append(this.views[v].render().el);

			$(this.el).append(title);
			$(this.el).append(children);
			$(this.el).append(attributes);
			
			return this;
		}
	});
});