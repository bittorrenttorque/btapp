config = {
	srp_root:'https://remote-staging.utorrent.com',
	remote_username:'username',
	remote_password:'password',
	toolbar: true, // currently means use jsonp for login
	jsonp: true,
	webui: false
};

function assert(condition) { if(!condition) debugger; }

function falcon_ready() {
	window.btapp = new Btapp({'falcon': window.client.raptor.api});
}

function create_btapp() {
	//create falcon object
	for (var i = 0; i < 3000; i++) {
		sjcl.random.addEntropy(Math.random(), 2);
	}
	
	window.clients = new ClientManager;
	var opts = { stay_signed_in: true, success: falcon_ready, error: function() {}, for_srp_only: true };
	clients.login_remote(config.remote_username, config.remote_password, opts);
}