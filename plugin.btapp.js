$(function() {
	var BTAPP_PLUGIN_ID = 'btapp_plugin';
	function add_plugin() {
		var object = $('<object></object>');
		object.attr('id', BTAPP_PLUGIN_ID);
		object.attr('type', 'application/x-btlauncher');
		object.attr('width', '0');
		object.height('height', '0');
		$('body').append(object);
	}
	function remove_plugin() {
		$('#btapp_plugin').remove();
	}
	function plugin() {
		return document.getElementById(BTAPP_PLUGIN_ID);
	}
	function check_for_plugin() {
		add_plugin();
		if('isRunning' in plugin()) {
			if(install_plugin_dialog_visible()) {
				hide_install_plugin_dialog();
			}
			if(install_plugin_background_visible()) {
				hide_install_plugin_background();
			}
			if(!download_arrow_visible()) {
				hide_download_arrow();
			}
		} else {
			if(!install_plugin_dialog_visible()) {
				show_install_plugin_background();
				show_install_plugin_dialog();
			}
			remove_plugin();
			setTimeout(check_for_plugin, 1000);
		}
	}
	function show_install_plugin_dialog() {
		var install = $('<div></div>');
		install.attr('id', 'install');
		install.addClass('modal hide fade');
		
		var header = $('<div></div>');
		header.addClass('modal-header');
		var close = $('<a></a>');
		close.text('×');
		close.attr('href','"#"');
		close.addClass('close');
		var title = $('<h4></h4>');
		title.text('Powered by BitTorrent');
		header.append(close);
		header.append(title);
		
		var body = $('<div></div>');
		body.addClass('modal-body');
		var paragraph = $('<p></p>');
		paragraph.text('This site requires the BitTorrent plugin.');
		body.append(paragraph);
		
		var footer = $('<div></div>');
		footer.addClass('modal-footer');
		var button = $('<a id="crx_download" href="http://pwmckenna.com/projects/btapp/plugins/chrome_win32.crx" class="btn primary">Download</a>');
		button.click(downloading_plugin);
		footer.append(button);
		
		install.append(header);
		install.append(body);
		install.append(footer);
		$('body').append(install);
		$('#install').modal('show');
	}
	function hide_install_plugin_dialog() {
		$('#install').modal('hide');
	}
	function install_plugin_dialog_visible() {
		return $('#install').length > 0;
	}
	function install_plugin_background_visible() {
		return $('.modal-backdrop').length > 0;
	}
	function show_install_plugin_background() {
		var background = $('<div></div>');
		background.addClass('modal-backdrop fade in');
		$('body').append(background);
	}
	function hide_install_plugin_background() {
		$('.modal-backdrop').remove();
	}
	function downloading_plugin() {
		hide_install_plugin_dialog();
		show_download_arrow();
	}
	function download_arrow_visible() {
		return $('#arrow').length > 0;
	}
	function show_download_arrow() {
		var div = $('<div></div>');
		div.addClass('arrow');
		div.css('position', 'absolute');
		div.css('left', '25px');
		div.css('bottom', '25px');
		div.css('width', '125px');
		div.css('height', '123px');
		div.css('background', 'url("http://www.pwmckenna.com/img/chrome_arrow.png") !important');
		div.css('z-index', 10001);
		$('body').append(div);
	}
	function hide_download_arrow() {
		$('#arrow').remove();
	}
	
	check_for_plugin();
});