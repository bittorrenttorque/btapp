/*

 Handles key negotiation and sessions through remote


 new falcon.session()


 */
BigInteger.prototype.toPaddedHex = function(paddedLength) {
    var hex = this.toString(16);
    while (hex.length < paddedLength)
        hex = "0" + hex;
    return hex;
}

BigInteger.prototype.toAscii = function(expectedLengthInCharacters) {
    var out = '';
    var hex = this.toPaddedHex(expectedLengthInCharacters);
    for (var i = 0, ii = hex.length; i < ii; i += 2)
    out += String.fromCharCode(parseInt(hex.charAt(i) + hex.charAt(i + 1), 16));
    return out;
}

for (var i=0;i<1000;i++) {
    // seed with something better please!
    sjcl.random.addEntropy(Math.random(), 2);
}

falcon.session = function() {
}

falcon.session.prototype = {

    set_progress_range: function(low, hi, pct) {
        var width = Math.min((hi-low)*pct+low, hi);
        this.set_progress(width);
    },
    set_progress: function(amount) {
        if (this.options && this.options.progress) {
            this.options.progress(amount);
        } else {
            console.log('progress',amount);
        }
    },
    set_label: function(message) {
        if (this.options && this.options.label) {
            this.options.label(message);
        } else {
            console.log('label',message);
        }
    },
    error_out: function(data, xhr, text) {
        console.error('error in key negotiation');
        if (config.asserts) { debugger; }
        if (this.options && this.options.error) { 
            return this.options.error(data, xhr);
        } else {
            alert(data);
        }
    },
    jsonp_error: function(data, xhr, text) {
        // uncatchable jsonp error
        debugger;
        this.error_out(data. xhr);
    },

    get_srp_url: function(data, newsession) {
        var url = config.srp_root + '/api/login/'; // needs trailing slash

        if (newsession) {
            url = url + '?new=1';
        } else if (this.guid) {
            url = url + '?GUID=' + encodeURIComponent(this.guid);
        } else {
            throw new falcon.exception.invalid('no session id');
        }
        for (var key in data) {
            url = url + '&' + encodeURIComponent(key) + '=' + encodeURIComponent( data[key] );
        }
        return url;
    },

    negotiate: function(username, password, options) {
        this.options = options;
        this.credentials = {username: username, password: password};
        this.username = username;
        var data = {
            user: username
        };

        jQuery.ajax(this.get_srp_url(data, true), { 
                        dataType: 'jsonp',
                        cached: false,
                        error: _.bind(this.jsonp_error, this),
                        success: _.bind(this.create_public_key, this) } );
    },
    create_public_key: function(data, code, xhr) {
        if (data.error) {
            console.error('error getting generator', data);
            return this.error_out(data);
        }
        this.guid = data.guid;
        var response = data.response;

        if (! response.length || response.length != 3) {
            console.error('public key response makes no sense', response);
            return this.error_out(response);
        }

        this.set_progress(.3);
        this.set_label("Creating public key...");
        this.modulus = new BigInteger(response[0], 10);
        this.generator = new BigInteger(response[1], 10);
        this.salt = new BigInteger(response[2], 10);
        this.exponent = new BigInteger(sjcl.codec.hex.fromBits(sjcl.random.randomWords(5)), 16);
        if (window.jQuery && jQuery.jStorage) {
            jQuery.jStorage.set('entropySeed', sjcl.random.randomWords(9));
        }
        var _this = this;
        function progress_fn(pct) {
            return _this.set_progress_range(0.3, 0.45, pct);
        }
        this.generator.modPow(this.exponent, this.modulus, _.bind(this.created_public_key, this), progress_fn);
    },
    created_public_key: function(public_key) {
        this.public_key = public_key;
        var data = {
            username: this.username,
            pub: public_key.toString(10),
            time: new Date().getTime()
        };
        jQuery.ajax(this.get_srp_url(data), { dataType: 'jsonp',
                                              cached: false,
                                              error: _.bind(this.jsonp_error, this),
                                              success: _.bind(this.sent_public_key, this) } );
    },
    sent_public_key: function(data, status, xhr) {
        // this should not be an anonymous function!
        if (data.error)  {
            console.error('error',data);
            this.error_out( data.error );
            return;
        }
        var response = data.response;
        this.create_session_key(xhr, new BigInteger(response[0], 10), this.modulus, this.generator, this.salt, this.exponent);
    },
    create_session_key: function(xhr, server_key, modulus, generator, salt, exponent) {
        this.set_progress(.45);
        this.set_label("Creating session key...");

        this.server_key = server_key;
        // We abort the protocol here if B == 0 (mod N).
        if (0 == this.server_key.modPow(new BigInteger("1", 10), this.modulus)) {
            this.error_out("The client provided an invalid public key. " + server_key + "Please try again.");
        }

        var kay = new BigInteger("3", 10);
        var u = new BigInteger(
            sha1Hash(this.public_key.toAscii(320) + this.server_key.toAscii(320)), 16);

        // We abort the protocol here if u == 0.
        var _this = this;
        u.modPow(new BigInteger("1", 10), this.modulus, function(result) {
                     if (0 == result) {
                         alert("The client provided an invalid exponent (\"u\"). " + "Please try again.");
                         throw "Server provided a \"u\" parameter which was = 0 mod N. " + "Aborting SRP process.";
                     }
                 });
        var username = jQuery('#username').val() || this.credentials.username;
        var password = jQuery('#password').val() || this.credentials.password;
        this.credentials = null;
        var usernameAndPassword = username + ':' + password;
        var usernameAndPasswordHash = sha1Hash(usernameAndPassword);
        var usernameAndPasswordInt = new BigInteger(usernameAndPasswordHash, 16);
        password = new BigInteger(
            sha1Hash(salt.toAscii(20) + usernameAndPasswordInt.toAscii(usernameAndPasswordHash.length)), 16);

        function progress_fn(pct) {
            return _this.set_progress_range(0.45, 0.7, pct);
        }
        function progress_fn2(pct) {
            return _this.set_progress_range(0.7, 0.95, pct);
        }
        generator.modPow(password, modulus, function(g_to_the_x) {
                             negative_g_to_the_x = modulus.subtract(g_to_the_x);
                             negative_g_to_the_x_times_k = negative_g_to_the_x.multiply(kay);
                             _this.server_key.add(negative_g_to_the_x_times_k).modPow(
                                 new BigInteger("1", 10), modulus, function(key_base) {
                                     key_exponent = exponent.add(u.multiply(password));
                                     key_base.modPow(key_exponent, modulus, function(client_num) {
                                                         //jQuery.debug("client_num ('pre-key'): " + client_num.toString(10));
                                                         client_hash = sha1Hash(client_num.toAscii(320));
                                                         _this.client_key = new BigInteger(client_hash, 16);
                                                         // We only want the first 16 bytes of the key because we're only
                                                         // using AES-128.
                                                         _this.verify_key(_this.client_key.toPaddedHex(40).slice(0, 40));
                                                     }, progress_fn2);
                                 });
                         }, progress_fn);
    },

    compute_verify_key_one: function(client_key) { /* M1 = H(H(N) XOR H(g) | H(l) | s | A | B | KCarol) */

        //this.set_progress(.8);
        this.set_label("Sending key verifier to ...");

        var xor_term = new BigInteger(sha1Hash(this.modulus.toAscii(320)), 16).xor(new BigInteger(sha1Hash(
                                                                                                      this.generator.toAscii(2)), 16));
        var A = this.public_key;
        var B = this.server_key;
        this.client_key = client_key;
        this.client_key_str = client_key.toPaddedHex(40).slice(0, 40);

        var M1_pre_hash = xor_term.toAscii(40) + new BigInteger(
            sha1Hash(this.username), 16).toAscii(40) + this.salt.toAscii(20) + A.toAscii(320) + B.toAscii(320) + this.client_key.toAscii(40);
        var M1 = sha1Hash(M1_pre_hash);
        this.M1 = new BigInteger(M1, 16);
        return this.M1.toString(10);
    },
    compute_verify_key_two: function(key) { /* M2 = H(A | M1 | KSteve) */
        var A = this.public_key;

        //this.set_progress(.9);
        this.set_label("Verifying key ...");

        var M2 = sha1Hash(A.toAscii(320) + this.M1.toAscii(40) + key.toAscii(40));
        return new BigInteger(M2, 16).toString(10);
    },
    // Confusingly, we run verify using "client_key," which is the full 20-byte
    // SHA-1 hash, but we use the 16-byte prefix, "key," as the actual AES key,
    // since we're using AES-128.
    verify_key: function(key) {
        if (! key) { if (config.asserts) { debugger; } }
        var _this = this;
        if (window.eventTracker) eventTracker.track('Login', 'SendVerify');
        var data =         {
            username: _this.username,
            verify: _this.compute_verify_key_one(_this.client_key),
            time: new Date().getTime()
        };
        jQuery.ajax(_this.get_srp_url(data), { dataType: 'jsonp',
                                               cached: false,
                                               error: _.bind(this.jsonp_error, this),
                                               success: _.bind(this.got_key_verify, this) } );
    },
    got_key_verify: function(data, status, xhr) {
        var _this = this;
        if (data.error)  {
            console.error('error',data);
            this.error_out( data.error );
            return;
        }
        var response = data.response;

        var M2 = response[0];
        if (M2 == _this.compute_verify_key_two(_this.client_key)) {
            _this.set_progress(1);
            _this.set_label("Verification complete!");

            var tkt = data.bt_talon_tkt;
            if (tkt) {
                var guid = _this.guid;
                var client_data = { key: this.client_key_str,
                                    bt_talon_tkt: tkt,
                                    bt_user: _this.username,
                                    cid: data.cid,
                                    host: data.host,
                                    guid: guid,
                                    version: data.version
                                  };

                console.log('log in success with client data',client_data);
                var api = new falcon.api(client_data);
                _this.api = api;

                if (this.options && this.options.success) {
                    this.options.success( this );
                }
            }
        } else {
            _this.error_out("Verification response from the remote client was invalid. This could be due to an " + "intermittent connection problem or a username " + "or password mismatch. Please check them and try " + "again.");
        }
    }
}