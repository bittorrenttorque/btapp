var WINDOW_HASH = '4823';
function plugin() {
	return document.getElementById('btapp_plugin');
}
function check_for_client() {
/**
	var ut_running = plugin().isRunning('Torrent' + WINDOW_HASH);
	var bt_running = plugin().isRunning('BT' + WINDOW_HASH);
	//lets stop running clients...we don't know if they're compatible
	if(ut_running.length > 0) plugin().stopRunning(ut_running[0]);
	if(bt_running.length > 0) plugin().stopRunning(bt_running[0]);
**/
	//now that everything has been cleared out...lets download the version that we know works
	var url = 'http://pwmckenna.com/projects/btapp/plugins/utorrent-3.2-beta-beta-26655.exe';
	plugin().downloadProgram('uTorrent', url, function(a,b,c) { 
		if(plugin().isRunning('Torrent' + WINDOW_HASH).length == 0) {
			//we still don't have a client running...lets try running the one on disk if there is one
			plugin().runProgram('uTorrent');
		}
	} );
}
function check_for_plugin() {
	$('body').append($('<object id="btapp_plugin" type="application/x-btlauncher" width="0" height="0"></object>'));
	//we should continue to show the download dialog until we've installed the extension
	if('isRunning' in plugin()) {
		hide_plugin_installer();
		check_for_client();
	} else {
		if(!plugin_installer_visible()) {
			show_plugin_installer();
		}
		$("#btapp_plugin").remove();
		setTimeout(check_for_plugin, 1000);
	}
}

function plugin_installer_visible() {
	return $("#install").is(":visible");
}

function show_plugin_installer() {
	$('#install .modal-body p').show();
	$('#install .modal-body img').hide();
	$('#install .modal-footer').show();
	$("#install").modal('show');
	$('.modal-backdrop').show();
}

function hide_plugin_installer() {
	$('.modal-backdrop').hide();
	$("#install").modal('hide');
}

function show_plugin_installer_downloading() {
	$('#install .modal-body p').hide();
	$('#install .modal-body img').show();
	$('#install .modal-footer').hide();
}

$(function() {
	var permission = $('\
	<div id="permission" class="modal hide fade in" style="display: none; ">\
		<div class="modal-header">\
			<a href="#" class="close">×</a>\
			<h4 id="permission_header">' + (window.location.hostname || window.location.href) + '</h4>\
		</div>\
		<div class="modal-body">\
			<p>This site is requesting access to your BitTorrent powered capabilities.</p>\
		</div>\
		<div class="modal-footer">\
			<a href="#" class="btn secondary">Deny</a>\
			<a href="#" class="btn primary">Allow</a>\
		</div>\
	</div>');
	var install = $('\
	<div id="install" class="modal hide fade" style="display: none; ">\
		<div class="modal-header">\
			<a href="#" class="close">×</a>\
			<h4 id="permission_header">Powered by BitTorrent</h4>\
		</div>\
		<div class="modal-body">\
			<p>This site requires the BitTorrent plugin.</p>\
			<img src="http://www.pwmckenna.com/img/chrome_warning.png" />\
		</div>\
		<div class="modal-footer">\
			<a id="crx_download" href="http://pwmckenna.com/projects/btapp/plugins/chrome_win32.crx" class="btn primary">Download</a>\
		</div>\
	</div>');
	$('body').append('<div class="modal-backdrop fade in" style="display:none;"></div>');
	
	$('body').append(install);
	$('body').append(permission);
	$('#install .modal-body img').hide();
	$('#install .close').click(function() {
		hide_plugin_installer();
	});
	$('#crx_download').click(function() {
		show_plugin_installer_downloading();
	});
	check_for_plugin();
});