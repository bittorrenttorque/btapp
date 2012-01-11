var QUERIES = [ 'btapp/' ];
$(function() {
/**
	var attributes = {
		queries: QUERIES,
		poll_frequency: 5000,
		username: 'XXX',
		password: 'XXX',
	};
**/
	var attributes = { queries: QUERIES };
	window.btapp = new Btapp(attributes);
});