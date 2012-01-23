$(function() {
	function assert(condition) { if(!condition) debugger; }

	window.BtappContentView = Backbone.View.extend({
		tagName: "div",
		className: "content",
		initialize: function() {
			_.bindAll(this, 'render', 'show');
			this.model.bind('change', this.render);
			this.model.bind('destroy', this.remove);
			
			$(this.el).hide();
		},
		render: function() {
			$(this.el).empty();
			var url = $('<div><h4>url:</h4></div>');
			url.append('<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + this.model.url + '</p>');
			url.addClass('url');
			$(this.el).append(url);
			
			//add the attributes
			var attributes = $('<div><h4>attributes:</h4></div>');
			for(var a in this.model.attributes) {
				var attribute = this.model.attributes[a];
				if(!(typeof attribute === 'object') || !('bt' in attribute)) {
					attributes.append('<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="variable">' + a + '</span>: ' + attribute + '</p>');
				}
			}
			$(this.el).append(attributes);
			
			//add function information
			var functions = $('<div><h4>functions:</h4></div>');
			for(var b in this.model.bt) {
				var signatures = this.model.bt[b].valueOf().split('(');
				functions.append('<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + b + ':</p>');
				for(var i = 1; i < signatures.length; i++) {
					functions.append('<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="function">function</span>(' + signatures[i] + '</p>');
				}
			}
			functions.addClass('functions');
			$(this.el).append(functions);
			
			return this;
		},
		show: function() {
			$('.content').hide();
			$(this.el).show();
		}
	});

	window.BtappCollectionSidebarView = Backbone.View.extend({
		tagName: "div",
		initialize: function() {
			_.bindAll(this, '_add', '_remove', 'render');
			this.model.bind('add', this._add);
			this.model.remove('remove', this._remove);
			this.model.bind('destroy', this.remove);
			
			this.expanded = false;
			this._views = {};
			this.model.each(this._add);
			this.content = new BtappContentView({'model':this.model});
			$('#content').append(this.content.render().el);
		},
		_add: function(model) {
			assert(typeof model === 'object' && 'bt' in model);
			console.log('_add(' + $.toJSON(model) + ')');
			this._views[model.cid] = new BtappModelSidebarView({'model':model});
		},
		_remove: function(model) {
			assert(typeof model === 'object' && 'bt' in model);
			console.log('_remove(' + $.toJSON(model) + ')');
			this._views[model.cid].destructor();
			delete this._views[model.cid];
		},
		render: function() {
			$(this.el).empty();
			if(this.model.url) {
				var toggle = $('<div></div>');
				toggle.addClass('toggle');
				if(_.keys(this._views).length > 0) {
					toggle.addClass(this.expanded ? 'down' : 'right');
				}
				$(this.el).append(toggle);
				toggle.click(_.bind(function(toggle) {
					if(!toggle.hasClass('right') && !toggle.hasClass('down')) return;

					$(this.el).children('.children').toggle();
					if(toggle.hasClass('right')) {
						toggle.removeClass('right');
						toggle.addClass('down');
					} else {
						toggle.removeClass('down');
						toggle.addClass('right');
					}
					this.expanded = !this.expanded;
				}, this, toggle));

				var toks = this.model.url.split('/');
				var link = $('<a href="#">' + unescape(toks[toks.length-2]) + '</a>');
				link.click(this.content.show);
				$(this.el).append(link);
				
				if(_.keys(this._views).length > 0) {
					var children = $('<div></div>');
					children.addClass('children');
					for(var v in this._views) {
						children.append($(this._views[v].render().el));
					}
					if(!this.expanded) {
						children.hide();
					}
					$(this.el).append(children);
				}
			}
			return this;
		}
	});
	window.BtappModelSidebarView = Backbone.View.extend({
		tagName: "div",
		initialize: function() {
			_.bindAll(this, 'render', '_add', '_remove');
			this.model.bind('add', this._add);
			this.model.bind('remove', this._remove);
			this.model.bind('change', this.render);
			this.model.bind('destroy', this.remove);
			
			this.expanded = false;
			this._views = {};
			_.each(this.model.attributes, _.bind(function(value, key) {
				this._add(value);
			}, this));
			
			this.content = new BtappContentView({'model':this.model});
			$('#content').append(this.content.render().el);
		},
		_add: function(attribute) {
			console.log('_add(' + $.toJSON(attribute) + ')');
			if(typeof attribute === 'object' && 'bt' in attribute) {
				if('length' in attribute) {
					this._views[attribute.url] = new BtappCollectionSidebarView({'model':attribute});
				} else {
					this._views[attribute.url] = new BtappModelSidebarView({'model':attribute});
				}
			}
		},
		_remove: function(attribute) {
			console.log('_remove(' + $.toJSON(attribute) + ')');
			if(typeof attribute === 'object' && 'bt' in attribute) {
				for(var v in this._views) {
					if(this._views[v].model.cid == attribute.cid) {
						this._views[v].model.trigger('destroy');
					}
				}
			}
		},
		render: function() {
			$(this.el).empty();
			if(this.model.url) {
				var toggle = $('<div></div>');
				toggle.addClass('toggle');
				if(_.keys(this._views).length > 0) {
					toggle.addClass(this.expanded ? 'down' : 'right');
				}
				$(this.el).append(toggle);
				toggle.click(_.bind(function(toggle) {
					if(!toggle.hasClass('right') && !toggle.hasClass('down')) return;

					$(this.el).children('.children').toggle();
					if(toggle.hasClass('right')) {
						toggle.removeClass('right');
						toggle.addClass('down');
					} else {
						toggle.removeClass('down');
						toggle.addClass('right');
					}
					this.expanded = !this.expanded;
				}, this, toggle));

				var toks = this.model.url.split('/');
				var link = $('<a href="#">' + unescape(toks[toks.length-2]) + '</a>');
				link.click(this.content.show);
				$(this.el).append(link);
				
				if(_.keys(this._views).length > 0) {
					var children = $('<div></div>');
					children.addClass('children');
					for(var v in this._views) {
						children.append($(this._views[v].render().el));
					}
					if(!this.expanded) {
						children.hide();
					}
					$(this.el).append(children);
				}
			}
			return this;
		}
	});

	window.btappview = new window.BtappModelSidebarView({'model':new Btapp({'id':'btapp'})});
	window.btappview.expanded = true;
	$('#sidebar').append(window.btappview.render().el);
	btappview.content.show();
});