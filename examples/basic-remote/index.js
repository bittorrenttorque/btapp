function got_token(token) {
    session.api.request('GET', '/client/gui/', {list:1}, {}, function(data) {
                            console.log('got some data',data);
                        });
}

function logged_in(session) {
    session.api.request('GET', '/client/gui/token.html', {}, {}, got_token );
}


var session = new falcon.session();
session.negotiate('kylevm','pass', { success: logged_in } );


