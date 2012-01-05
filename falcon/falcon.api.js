(function() {

     function make_part(v,k) {
         return 'Content-Disposition: multipart/form-data; name="' + k + '"\r\n\r\n' + v + '\r\n';
     }

     falcon.api = function(client_data) {
         this.boundary = 'AaB03x';
         this.client_data = client_data;
         this.cipher = new falcon.cipher(client_data.key);
         this.jsonp = true;
     };

     falcon.api.prototype = {
         /**
          * Makes a proxy request through falcon to the client.
          * @param {String} method GET or POST.
          * @param {String} base_url the request URL.
          * @param {Object or String} url_params parameters or the uri string (appended to base_url)
          * @param {Object} body_params encrypted POST body.
          * @param {Function} callback success callback.
          * @param {Function} failure_callback failure callback.
          * @param {Function} options request options.
          */
         request: function(method, base_url, url_params, body_params, callback, failure_callback, options) {
             var _this = this;

             if (_.isString(url_params)) {
                 var url = base_url + "?" + url_params;
             } else {
                 var url = base_url + "?" + _this.make_request_url(url_params);
             }
             if (this.jsonp) { url = this.client_data.host + url; }

             var data = _.extend({
                                     token: _this.token,
                                     t: (new Date()).getTime()
                                 }, body_params);

             var post_body = _this.make_post_body( data );
             var xbtseq = _this.cipher.ivoffset; // GRAB this before encrypting!!!
             var encrypted_body = _this.cipher.encrypt( post_body );
             
             if (options && options.timeout) {
                 var timeout = options.timeout;
             } else {
                 var timeout = 40000;
             }

             if (this.jsonp) { 
                 method = 'GET'; 
                 url = url + '&encbody=' + encrypted_body + '&x_bt_seq=' + xbtseq + '&GUID=' + this.client_data.guid + '&bt_talon_tkt=' + encodeURIComponent(this.client_data.bt_talon_tkt);
                 encrypted_body = null;
             }

             var async = true;

             var ajax_options = {
                 url: url,
                 type: method,
                 data: encrypted_body,
                 timeout: timeout,
                 dataType: this.jsonp ? 'jsonp' : 'text',
                 processData: false,
                 contentType: 'application/octet-stream; boundary=' + _this.boundary + '; charset=ascii',
                 beforeSend: function(xhr) {
                     //xhr.setRequestHeader("x-bt-seq", xbtseq); // send this as a query parameter instead.
                 },
                 error: function(xhr, status, text) {
                     if (_this.jsonp) {
                         console.error('BAD! always expect 200 responses from raptor');
                     }
                     failure_callback(null, status, xhr, text);
                 }
             };
             ajax_options.success = _.bind(this.on_request_response, this, ajax_options, callback, failure_callback);
             return jQuery.ajax(ajax_options);
         },
         decrypt_response: function(origdata, status, xhr, options) {
             // decrypts the response and updates the cipher sequence
             var _this = this;
             var bt_seq = xhr.getResponseHeader('x-bt-seq');
             if (origdata.encbody && origdata.GUID && origdata['x-bt-seq']) {
                 _this.cipher.ivoffset = parseInt(origdata['x-bt-seq']);
                 origdata = origdata.encbody;
             } else {
                 _this.cipher.ivoffset = parseInt(bt_seq ? bt_seq : "0");
             }
             var opts = options;
             var response = _this.cipher.decrypt(origdata, opts);
             return response;
         },
         decrypt_response_async: function(origdata, status, xhr, callback, options) {
             // decrypts the response asynchronously (yielding to prevent
             // javascript from locking up) and updates the cipher sequence
             var _this = this;
             var bt_seq = xhr.getResponseHeader('x-bt-seq');
             if (origdata.encbody && origdata.GUID && origdata['x-bt-seq']) {
                 _this.cipher.ivoffset = parseInt(origdata['x-bt-seq']);
                 origdata = origdata.encbody;
             } else {
                 _this.cipher.ivoffset = parseInt(bt_seq ? bt_seq : "0");
             }
             _this.cipher.decrypt_async(origdata, function(data) {
                                            callback(origdata, data, status, xhr);
                                        }, options);
         },
         make_post_body: function(params) {
             var _this = this;
             var body = '--' + _this.boundary + '\r\n';
             var bodyparts = [];
             _.each(params, function(val,key) {
                        // support multidict... (torrent hashes...)
                        if (_.isArray(val)) {
                            _.each(val, function(item) {
                                       bodyparts.push( make_part(item, key) );
                                   });
                        } else {
                            bodyparts.push( make_part(val, key) );
                        }
                    });
             body += bodyparts.join('--' + _this.boundary + "\r\n");
             body += '--' + _this.boundary + '\r\n\r\n\r\n';
             return body;
         },
         make_request_url: function(params) {
             if (! params || _.keys(params).length==0) { 
                 params = {nop:1};
             }
             var parts = [];
             _.each(params, function(val,key) {
                        if (val !== undefined) {
                            if (_.isArray(val)) {
                                _.each(val, function(item) {
                                           parts.push( key + '=' + encodeURIComponent(item) );
                                       });
                            } else {
                                parts.push( key + '=' + encodeURIComponent(val) );
                            }
                        }
                    });
             return parts.join('&');
         },
         on_request_response: function(request, callback, failure_callback, data, status, xhr) {
             var _this = this;
             if (! data) {
                 failure_callback(xhr, status, 'empty response body');
             } else {
                 if (request.url.match('/gui/token.html')) {
                     // token is not returned via JSON and returned differently for JSONP :-(
                     data = _this.decrypt_response(data, status, xhr, { encoding: 'ascii' } );
                     if (_this.jsonp) {
                         _this.token = data;
                     } else {
                         var matches = data.match(/\'\>(.*)\<\/d/);
                         if (matches && matches.length == 2) {
                             _this.token = matches[1];
                         }
                     }
                     if (_this.token && _this.token.length == 64) {
                         console.log('Received token',_this.token);
                         callback(this.token, status, xhr);
                     } else {
                         console.error('invalid token');
                         failure_callback(status, xhr, 'invalid token: ' + data);
                     }

                 } else {
                     _this.decrypt_response_async(data, status, xhr, _.bind(this.on_request_response_decrypted, this, request, callback, failure_callback));
                 }
             }
         },
         on_request_response_decrypted: function(request, callback, failure_callback, orig_data, decrypted_data, status, xhr) {
             var json = null;
             try { 
                 // client sends invalid utf-8 inside
                 // strings, which can cause quotes on
                 // the ends of string literals to be
                 // interpreted as parts of multi-byte
                 // character sequences (breaking
                 // JSON).

                 // thus, TODO:
                 // if this fails, fall back to ASCII
                 var json = jQuery.parseJSON(decrypted_data);
             } catch (e) {
                 console.error('utf 8 decoding failed');
             }
             if (json) {
                 if (callback) {
                     callback(json, status, xhr);
                 } else {
                     console.log('got response',json);
                 }
             } else {
                 failure_callback(xhr, status, 'invalid json: ' + decrypted_data);
             }
         }
     };

 })();