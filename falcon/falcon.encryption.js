falcon.cipher = function(key, mode, Tlen) {
    this.mode = mode, this.Tlen = Tlen;
    this.store = jQuery.jStorage;
    this.block_size = 16;
    this.ivoffset = 0;
    this.async_decrypt_blocks = 1000;
    this.createCTRCipher(key);
};

falcon.cipher.prototype = {
    /* XXX: Assumes key is hex */
    createCTRCipher: function(key) {
        var aeskey = [];
        if (key) {
            var words = [];
            this.bytesToWords(this.hexToBytes(key), words);
            var key_words = words.splice(0, 4);
            this.iv = [];
            this.wordsToBytes([words[0], words[0], words[0], words[0]], this.iv);
            this.wordsToBytes(key_words, aeskey);
            this.cipher = new sjcl.cipher.aes(sjcl.codec.hex.toBits(key.slice(0, 32)));
        }
    },

    inc_ctr: function(ctr) {
        // we do big-endian increment since tomcrypt does that - dunno why
        var offset = sjcl.codec.hex.fromBits([this.ivoffset]);
        var l = offset.length;

        var offsets = [];
        for (var i = 0, j = 0; i < l; i += 2, j++) {
            offsets[j] = parseInt(offset.charAt(i) + offset.charAt(i + 1), 16);
        }
        offsets = offsets.reverse();
        l = offsets.length;

        var carryover = 0;
        for (var i = 0; i < l; i++) {
            // base 256 arithmetic .... this was bloody expensive!!!!
            offsets[i] += carryover;
            ctr[i] += offsets[i];
            carryover = ctr[i] >= 256 ? 1 : 0;
            ctr[i] %= 256;
        }
        return ctr;
    },

    ctr_crypt_block: function(input) { /* generate ctr blocks */
        try {
            var ctr = this.iv.slice();
        } catch (e) {
            var userErrorMessage = "AES initialization vector is undefined";
            alert(userErrorMessage);
            throw (e);
        }
        this.inc_ctr(ctr);

        /* generate masks */
        var mask = new Array(16);
        var cblocks = [];
        var hex = this.bytesToHex(ctr);
        cblocks = sjcl.codec.hex.toBits(hex);
        mask = this.hexToBytes(sjcl.codec.hex.fromBits(this.cipher.encrypt(cblocks)));

        var output = [];
        for (var j = 0; j < input.length; j++) {
            output[j] = input[j] ^ mask[j];
        }
        this.ivoffset++;
        return output;
    },

    /* 
     * only one crypt function is required as decrypting merely means encrypt the
     * cipher text
     */
    ctr_crypt: function(input) {
        var output = [];
        var block_size = 16;
        for (var cur_block = 0; cur_block < input.length/block_size; cur_block++) {

            var decoded = this.ctr_crypt_block( input.slice(cur_block * block_size, (cur_block + 1) * block_size ) );

            for (var i=0; i < block_size; i++) {
                output.push(decoded[i]);
            }

        }
        return output;
    },

    removeTrailingNuls: function(bytes) {
        var len = bytes.length;
        var isString = typeof bytes === "string";
        for (var i = len - 1; i >= 0; i--) {
            // XXX: very very bad!!!!
            if (isString && bytes[i] == "\0") bytes = bytes.slice(0, i); 
            else if (bytes[i] == 0) bytes.pop();
            else break;
        }
        // XXX: wohooo strings.
        return bytes;
    },

    encrypt: function(text) {
        if (!this.cipher) return text;
        var bytes = [],
        ciphertext = [];
        this.asciiToBytes(text, bytes);
        var ciphertext = this.ctr_crypt(bytes);
        var r = this.bytesToHex(ciphertext);
        return r;
    },

    decrypt_async: function(text, callback, options) {
        // decrypts the data (eventually)
        // iPhone has an unforgiving function return timer (functions
        // must return within about 5 seconds... so decryption has to
        // be done in pieces
        var self = this;

        var input = this.hexToBytes(text); // array of integers
        // (0-255)
        var output = [];

        var block_limit = this.async_decrypt_blocks; // decrypt this many blocks at a
        // time. iphone 4 seems to handle 1000 ok...

        var current_block = 0;

        var total_blocks_to_decrypt = input.length/this.block_size; // is input
        // always a multiple of 16???
        // console.log(total_blocks_to_decrypt,'blocks to decrypt in chunks of max size',block_limit);

        this.decrypt_async_helper(input, total_blocks_to_decrypt, current_block, block_limit, output, function(data) {
            if (options && options.encoding == 'ascii') {
                var r = self.bytesToAscii(data);
            } else {
                var r = self.bytesToUnicode(data);
            }
            callback(r);
        });

    },

    decrypt_async_helper: function(input, totalblocks, startblock, numblocks, output, callback) {
        // decrypts up to "numbytes", and saves relevant state
        // information
        var self = this;

        for ( var blocks_decrypted = 0; blocks_decrypted <= numblocks; blocks_decrypted++ ) {

            var slicestart = (startblock + blocks_decrypted) * this.block_size;

            if (slicestart >= input.length) {
                callback(output);
                return;
            }

            var decoded = this.ctr_crypt_block( input.slice( slicestart, slicestart + this.block_size ) );

            for (var i=0; i < decoded.length; i++) {
                if (decoded[i] === 0) {
                    callback(output);
                    return;
                }
                output.push(decoded[i]);
            }

        }

        setTimeout( function() { 
            self.decrypt_async_helper(input, totalblocks, startblock + numblocks + 1, numblocks, output, callback);
        }, 1 );


    },

    decrypt: function(text, options) {
        if (!this.cipher || !(typeof text == 'string')) {
            return text;
        }
        var cipherBytes = this.hexToBytes(text);
        var plainBytes = this.ctr_crypt(cipherBytes);
        // remove trailing nul bytes
        this.removeTrailingNuls(plainBytes);
        if (options && options.encoding == 'ascii') {
            var r = this.bytesToAscii(plainBytes);
        } else {
            var r = this.bytesToUnicode(plainBytes);
        }
        return r;
    },
    wordsToBytes: function(words, bytes) {
        var bitmask = 1;
        for (var i=0; i < 7; i++) bitmask = (bitmask << 1) | 1;
        for (var i=0; i < words.length; i++) {
            var bstart = i*4;
            for (var j=0; j < 4; j++) {
                bytes[bstart+j] = (words[i] & (bitmask << (8*(3-j)))) >>> (8*(3-j));
            }
        }
    },

    bytesToWords: function(bytes, words) {
        var paddedBytes = bytes.slice();
        while (paddedBytes.length % 4 != 0) paddedBytes.push(0);
        var num_words = Math.floor(paddedBytes.length/4);
        for (var j=0; j < num_words; j++)
            words[j] = ((paddedBytes[(j<<2)+3]) | (paddedBytes[(j<<2)+2] << 8) | (paddedBytes[(j<<2)+1] << 16) | (paddedBytes[j<<2] << 24));
    },

    byteToHex: function(n) {
        var hexDigits = '0123456789ABCDEF';
        return (hexDigits.charAt(n >> 4) + hexDigits.charAt(n & 15));
    },

    bytesToHex: function(bytes) {
        var out = "";
        for (var i = 0, l = bytes.length; i < l; i++)
            out += this.byteToHex(bytes[i]);
        return out;
    },

    hexToBytes: function(hex) {
        var bytes = [];
        for (var i = 0; i < hex.length; i += 2)
            bytes.push(parseInt(hex.charAt(i) + hex.charAt(i + 1), 16));
        return bytes;
    },

    asciiToBytes: function(ascii, bytes) {
        var len = ascii.length;
        for (var i=0; i < len; i++)
            bytes[i] = ascii.charCodeAt(i);
    },

    bytesToAscii: function(bytes) {

  //      return _.map( bytes, function(byte) { return String.fromCharCode(byte); } ).join('');

        // strings are immutable... this is wasteful

        var ascii = "";
        var len = bytes.length;
        for (var i=0; i < len; i++) {
            ascii = ascii + String.fromCharCode(bytes[i]);
        }
        return ascii;

    },

    bytesToUnicode: function(bytes) {

        var chars = [];

        var i = 0;

        while (i < bytes.length) {
            var bite = bytes[i];
            if (bite < 128) {
                chars.push( String.fromCharCode(bite) );
                i += 1;
                continue;
            } else {
                var codebits = '';
                var bits = bite.toString(2);
                if (bits[1] == '0') {
					if (window.console && console.log)
                    	console.log('illegal utf8 encoding');
                    chars.push( '\ufffd' );
                    i += 1;
                    continue;
                }
                var total_bytes = 2;
                while (bits[total_bytes] == '1') {
                    total_bytes ++;
                }

                codebits += bits.slice(total_bytes, 8);
                
                for (var k=1; k < total_bytes; k++) {
                    var curbyte = bytes[i+k];
                    if (curbyte) {
                        codebits += (bytes[i+k]).toString(2).slice(2,8);
                    } else {
						if (window.console && console.log)
                        	console.log('illegal utf8 encoding');
                    }
                }

                i += total_bytes;
                chars.push( String.fromCharCode( parseInt(codebits,2) ) );
            }
        }
        return chars.join('');
    },
    boundary: 'AaB03x'
}

