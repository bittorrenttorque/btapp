if (! window._) {
    console.error('require underscore.js');
}
if (! window.jQuery) {
    console.error('require jquery');
}


if (! window.config) {
    var config = {
//        srp_root: 'https://remote.utorrent.com'
//        srp_root: 'http://10.10.90.24:9090'
        srp_root: 'http://192.168.56.1:9090'
    };
}

var falcon = {


    check_username: function() {
        // checks whether a username is taken
    }

    


};