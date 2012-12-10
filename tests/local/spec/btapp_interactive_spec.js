(function() {
    describe('Btapp Interactive Client Function Calls', function() {
        it('OPERATOR: SELECT ANY FILE', function() {});
        it('shows a file selection dialog and creates a torrent with a empty name', function() {
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) {
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        this.btapp.bt.create(
                            '', 
                            _.values(this.files), 
                            _.bind(function(hash) { this.hash = hash; }, this)
                        ); 
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');

            waitsFor(function() {
                return this.hash;
            }, 20000, 'torrent creation');

            waitsFor(function() {
                return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
            }, 5000, 'torrent to show up in the diffs');
        });
        it('shows a file selection dialog and creates a torrent with a null name', function() {
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) {
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        this.btapp.bt.create(
                            null, 
                            _.values(this.files), 
                            _.bind(function(hash) { this.hash = hash; }, this)
                        ); 
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');

            waitsFor(function() {
                return this.hash;
            }, 20000, 'torrent creation');

            waitsFor(function() {
                return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
            }, 5000, 'torrent to show up in the diffs');
        });
        it('shows a file selection dialog and throws an error creating a torrent with an undefined name', function() {
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) {
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        expect(_.bind(function() {
                            this.btapp.bt.create(
                                undefined, 
                                _.values(this.files), 
                                _.bind(function(hash) { this.hash = hash; }, this)
                            );
                        }, this)).toThrow('client functions do not support undefined arguments');
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');
        });     
        it('shows a file selection dialog and creates a torrent with a predefined name', function() {
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) {
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        this.btapp.bt.create(
                            'patrick', 
                            _.values(this.files), 
                            _.bind(function(hash) { this.hash = hash; }, this)
                        ); 
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');

            waitsFor(function() {
                return this.hash;
            }, 20000, 'torrent creation');

            waitsFor(function() {
                return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
            }, 5000, 'torrent to show up in the diffs');
        });
        it('shows a file selection dialog and creates a torrent', function() {
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) {
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        this.btapp.bt.create(
                            '', 
                            _.values(this.files), 
                            _.bind(function(hash) { this.hash = hash; }, this)
                        ); 
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');

            waitsFor(function() {
                return this.hash;
            }, 20000, 'torrent creation');

            waitsFor(function() {
                return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
            }, 5000, 'torrent to show up in the diffs');
        });
        it('OPERATOR: SELECT A FILE WITH A SPACE IN THE NAME', function() {});
        it('it creates a torrent from a file with a space in the name', function() {
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) { 
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        expect(_.values(this.files)[0].indexOf(' ')).not.toEqual(-1);
                        this.btapp.bt.create(
                            '', 
                            _.values(this.files), 
                            _.bind(function(hash) { this.hash = hash; }, this)
                        ); 
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');

            waitsFor(function() {
                return this.hash;
            }, 20000, 'torrent creation');

            waitsFor(function() {
                return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
            }, 5000, 'torrent to show up in the diffs');
        });
        it('OPERATOR: SELECT A FILE WITH A UNICODE CHARACTER IN THE NAME', function() {});
        it('it creates a torrent from a file with a unicode character in the name', function() {
            function isDoubleByte(str) {
                for (var i = 0, n = str.length; i < n; i++) {
                    if (str.charCodeAt( i ) > 255) { return true; }
                }
                return false;
            }
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) { 
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        expect(isDoubleByte(_.values(this.files)[0])).toBeTruthy();
                        this.btapp.bt.create(
                            '', 
                            _.values(this.files), 
                            _.bind(function(hash) { this.hash = hash; }, this)
                        ); 
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');

            waitsFor(function() {
                return this.hash;
            }, 20000, 'torrent creation');

            waitsFor(function() {
                return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
            }, 5000, 'torrent to show up in the diffs');
        });
        it('OPERATOR: SELECT A FILE WITH A \'(\' CHARACTER IN THE NAME', function() {});
        it('it creates a torrent from a file with a \'(\' character in the name', function() {
            function isDoubleByte(str) {
                for (var i = 0, n = str.length; i < n; i++) {
                    if (str.charCodeAt( i ) > 255) { return true; }
                }
                return false;
            }
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) { 
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        expect(_.values(this.files)[0].indexOf('(')).not.toEqual(-1);
                        this.btapp.bt.create(
                            function() {}, 
                            _.values(this.files), 
                            _.bind(function(hash) { this.hash = hash; }, this)
                        ); 
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');

            waitsFor(function() {
                return this.hash;
            }, 20000, 'torrent creation');

            waitsFor(function() {
                return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
            }, 5000, 'torrent to show up in the diffs');
        });
        it('OPERATOR: SELECT A FILE WITH A \')\' CHARACTER IN THE NAME', function() {});
        it('it creates a torrent from a file with a \')\' character in the name', function() {
            function isDoubleByte(str) {
                for (var i = 0, n = str.length; i < n; i++) {
                    if (str.charCodeAt( i ) > 255) { return true; }
                }
                return false;
            }
            runs(function() {
                this.btapp = new Btapp;
                this.btapp.connect();   
                this.hash = null;
            });
            
            waitsFor(function() {
                return this.btapp.bt.browseforfiles;
            });
            
            runs(function() {
                this.btapp.bt.browseforfiles(
                    _.bind(function(files) { 
                        this.files = files;
                        expect(_.values(this.files).length).toEqual(1);
                        expect(_.values(this.files)[0].indexOf(')')).not.toEqual(-1);
                        this.btapp.bt.create(
                            function() {}, 
                            '', 
                            _.values(this.files), 
                            _.bind(function(hash) { this.hash = hash; }, this)
                        ); 
                    }, this)
                );
            });
            
            waitsFor(function() {
                return this.files;
            }, 20000, 'file selection');

            waitsFor(function() {
                return this.hash;
            }, 20000, 'torrent creation');

            waitsFor(function() {
                return this.btapp.get('torrent') && this.btapp.get('torrent').get(this.hash);
            }, 5000, 'torrent to show up in the diffs');
        });
    });
}).call(this);