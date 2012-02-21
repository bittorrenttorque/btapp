(function() {
	describe('Btapp Unit Tests', function() {
		describe('BtappModel state updates', function() {
			it('adds and removes an attribute', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(model.get('testkey')).toEqual('testvalue');
				model.updateState('testsession', null, {'testkey':'testvalue'}, 'testurl');
				expect(model.get('testkey')).toBeUndefined();
			});
			it('adds attributes and clears state', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(model.get('testkey')).toEqual('testvalue');
				model.clearState();
				expect(model.get('testkey')).toBeUndefined();
			});
			it('throws an error if removing an attribute and providing the wrong previous value', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				var exception = 'trying to remove an attribute, but did not provide the correct previous value';
				expect(function() { model.updateState('testsession', null, {'testkey':'testvalue1'}, 'testurl') }).toThrow(exception);
			});
			it('throws an error if changing an attribute and providing the wrong previous value', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				var exception = 'trying to update an attribute, but did not provide the correct previous value';
				expect(function() { model.updateState('testsession', {'testkey':'testvalue2'}, {'testkey':'testvalue1'}, 'testurl') }).toThrow(exception);
			});
			it('throws an error if changing an attribute to the same value', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				var exception = 'trying to set a variable to the existing value';
				expect(function() { model.updateState('testsession', {'testkey':'testvalue'}, {'testkey':'testvalue'}, 'testurl') }).toThrow(exception);
			});
			it('adds a function', function() {
				var model = new BtappModel({'id':'test'});
				model.client = new LocalTorrentClient({'btapp':model});
				model.updateState('testsession', {'testfunc':'[nf]()'}, null, 'testurl');
				expect(typeof model.bt.testfunc).toEqual('function');
			});
			it('adds and removes a BtappModel', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey1':{'testkey2':{'testkey3':'testvalue'}}}, null, 'testurl');
				expect(model.get('testkey1') instanceof BtappModel).toBeTruthy();
				expect(model.get('testkey1').get('testkey2') instanceof BtappModel).toBeTruthy();
				model.updateState('testsession', null, {'testkey1':{'testkey2':{'testkey3':'testvalue'}}}, 'testurl');
				expect(model.get('testkey1')).toBeUndefined();
			});
			it('adds a BtappModel and clears state', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey1':{'testkey2':{'testkey3':'testvalue'}}}, null, 'testurl');
				var testkey1 = model.get('testkey1');
				expect(testkey1.get('testkey2')).toBeDefined();
				model.clearState();
				expect(testkey1.get('testkey2')).toBeUndefined();
			});
			it('adds a BtappCollection', function() {
				var model = new BtappModel({'id':'btapp'});
				model.updateState('testsession', {'torrent':{}}, null, 'btapp/');
				expect(model.get('torrent') instanceof BtappCollection).toBeTruthy();
			});
			it('adds a BtappCollection and ignores "all" when populating', function() {
				var model = new BtappModel({'id':'btapp'});
				model.updateState('testsession', {'torrent':{'all':{'01234':{}}}}, null, 'testurl');
				var torrent = model.get('torrent').get('01234');
				expect(torrent instanceof BtappModel).toBeTruthy();
			});
		});
		describe('BtappCollection state updates', function() {
			it('throws an exception if not given a valid url', function() {
				var collection = new BtappCollection;
				var exception = 'cannot updateState with an invalid collection url';
				expect(function() { 
					collection.updateState('testsession', null, null, 'testurl'); 
				}).toThrow(exception);
			});
			it('adds models', function() {
				var collection = new BtappCollection;
				collection.updateState('testsession', {'key1':{},'key2':{}}, null, 'btapp/torrent/');
				expect(collection.length).toEqual(2);
				expect(collection.get('key1') instanceof BtappModel).toBeTruthy();
				expect(collection.get('key2') instanceof BtappModel).toBeTruthy();
			});
			it('adds a function', function() {
				var collection = new BtappCollection;
				collection.client = new LocalTorrentClient({'btapp':new BtappModel});
				collection.updateState('testsession', {'testfunc':'[nf]()'}, null, 'btapp/torrent/');
				expect(typeof collection.bt.testfunc).toEqual('function');
			});
			it('throws an exception if trying to add a non-BtappModel', function() {
				var collection = new BtappCollection;
				expect(function() { 
					collection.updateState('testsession', {'key1':'value1','key2':{}}, null, 'btapp/torrent/');
				}).toThrow('trying to add an invalid type to a BtappCollection');
			});
		});
		describe('RPC argument validation', function() {
			beforeEach(function() {
				this.model = new BtappModel({'id':'test'});
				this.model.client = new LocalTorrentClient({'btapp':this.model});
				this.model.updateState('testsession', {'testfunc':'[nf](string,dispatch)'}, null, 'testurl');
			});
			it('throws error if return callback not provided', function() {
				this.exception = 'return value callback is not optional';
				this.func = _.bind(this.model.bt.testfunc, this);
				expect(this.func).toThrow(this.exception);
			});
			it('throws error if return callback is not of type function', function() {
				this.exception = 'the first argument must be a function that receives the return value for the call to the client';
				this.func = _.bind(this.model.bt.testfunc, this, 'asdf');
				expect(this.func).toThrow(this.exception);
			});
			it('throws error if too many arguments are provided', function() {
				this.exception = 'arguments do not match any of the function signatures exposed by the client';
				this.func = _.bind(this.model.bt.testfunc, this, function() {}, 'arg1', function() {}, 'arg3');
				expect(this.func).toThrow(this.exception);
			});
			it('throws error if arguments are not of the correct type', function() {
				this.exception = 'arguments do not match any of the function signatures exposed by the client';
				this.func = _.bind(this.model.bt.testfunc, this, function() {}, 'arg1', 'arg2');
				expect(this.func).toThrow(this.exception);
			});
			it('throws error if the function signature exposed by the client contains non recognized types', function() {
				this.model.updateState('testsession', {'invalidfunc':'[nf](string,invalidtype)'}, null, 'testurl');
				this.exception = 'there is an invalid type in the function signature exposed by the client';
				this.func = _.bind(this.model.bt.invalidfunc, this, function() {}, 'arg1', 'arg2');
				expect(this.func).toThrow(this.exception);
			});
			it('does not throw error if arguments match the expected types', function() {
				this.func = _.bind(function() {
					this.model.bt.testfunc(function() {}, 'arg1', function() {});
					throw 'did not throw exception';
				}, this);
				expect(this.func).toThrow('did not throw exception');
			});
		});
		describe('BtappCollection events', function() {
			it('triggers add event', function() {
				var collection = new BtappCollection;
				var add_callback = jasmine.createSpy();
				collection.bind('add', add_callback);
				collection.updateState('testsession', {'all':{'ABCD':{} } }, null, 'btapp/torrent/');
				expect(add_callback).toHaveBeenCalled();
			});
			it('triggers add:key event', function() {
				var collection = new BtappCollection;
				var add_callback = jasmine.createSpy();
				collection.bind('add:' + 'ABCD', add_callback);
				collection.updateState('testsession', {'all':{'ABCD':{} } }, null, 'btapp/torrent/');
				expect(add_callback).toHaveBeenCalled();
			});
			it('triggers remove event', function() {
				var collection = new BtappCollection;
				var remove_callback = jasmine.createSpy();
				collection.bind('remove', remove_callback);
				collection.updateState('testsession', {'all':{'ABCD':{} } }, null, 'btapp/torrent/');
				collection.updateState('testsession', null, {'all':{'ABCD':{} } }, 'btapp/torrent/');
				expect(remove_callback).toHaveBeenCalled();
			});
			it('triggers remove:key event', function() {
				var collection = new BtappCollection;
				var remove_callback = jasmine.createSpy();
				collection.bind('remove:' + 'ABCD', remove_callback);
				collection.updateState('testsession', {'all':{'ABCD':{} } }, null, 'btapp/torrent/');
				collection.updateState('testsession', null, {'all':{'ABCD':{} } }, 'btapp/torrent/');
				expect(remove_callback).toHaveBeenCalled();
			});
			it('triggers change event when a model changes in the collection', function() {
				var collection = new BtappCollection;
				var change_callback = jasmine.createSpy();
				collection.bind('change', change_callback);
				collection.updateState('testsession', {'all':{'ABCD':{'key':'value'} } }, null, 'btapp/torrent/');
				collection.updateState('testsession', {'all':{'ABCD':{'key':'value2'} } }, {'all':{'ABCD':{'key':'value'} } }, 'btapp/torrent/');
				expect(change_callback).toHaveBeenCalled();
			});
			it('triggers change:key event when a model changes in the collection', function() {
				var collection = new BtappCollection;
				var change_callback = jasmine.createSpy();
				collection.bind('change:' + 'ABCD', change_callback);
				collection.updateState('testsession', {'all':{'ABCD':{'key':'value'} } }, null, 'btapp/torrent/');
				collection.updateState('testsession', {'all':{'ABCD':{'key':'value2'} } }, {'all':{'ABCD':{'key':'value'} } }, 'btapp/torrent/');
				expect(change_callback).toHaveBeenCalled();
			});
		});
		describe('BtappModel events', function() {
			it('triggers add event', function() {
				var model = new BtappModel({'id':'test'});
				var add_callback = jasmine.createSpy();
				model.bind('add', add_callback);
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(add_callback).toHaveBeenCalledWith('testkey', 'testvalue');
				model.unbind('add', add_callback);
			});
			it('triggers add:key event', function() {
				var model = new BtappModel({'id':'test'});
				var add_callback = jasmine.createSpy();
				model.bind('add:' + 'testkey', add_callback);
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(add_callback).toHaveBeenCalledWith('testvalue');
				model.unbind('add:' + 'testkey', add_callback);
			});
			it('triggers remove event', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				model.bind('remove', remove_callback);
				var remove_callback = jasmine.createSpy();
				model.updateState('testsession', null, {'testkey':'testvalue'}, 'testurl');
				expect(remove_callback).toHaveBeenCalledWith('testkey', 'testvalue');
				model.unbind('remove', remove_callback);
			});
			it('triggers remove:key event', function() {
				var model = new BtappModel({'id':'test'});
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				model.bind('remove:' + 'testkey', remove_callback);
				var remove_callback = jasmine.createSpy();
				model.updateState('testsession', null, {'testkey':'testvalue'}, 'testurl');
				expect(remove_callback).toHaveBeenCalledWith('testvalue');
				model.unbind('remove:' + 'testkey', remove_callback);
			});
			it('triggers change event', function() {
				var model = new BtappModel({'id':'test'});
				var change_callback = jasmine.createSpy();
				model.bind('change', change_callback);
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(change_callback.callCount).toEqual(1);
				model.updateState('testsession', {'testkey':'newtestvalue'}, {'testkey':'testvalue'}, 'testurl');
				expect(change_callback.callCount).toEqual(2);
				model.updateState('testsession', null, {'testkey':'newtestvalue'}, 'testurl');
				expect(change_callback.callCount).toEqual(3);
				model.unbind('change', change_callback);
			});
			it('triggers change:key event', function() {
				var model = new BtappModel({'id':'test'});
				var change_callback = jasmine.createSpy();
				model.bind('change:' + 'testkey', change_callback);
				model.updateState('testsession', {'testkey':'testvalue'}, null, 'testurl');
				expect(change_callback.callCount).toEqual(1);
				model.updateState('testsession', {'testkey':'newtestvalue'}, {'testkey':'testvalue'}, 'testurl');
				expect(change_callback.callCount).toEqual(2);
				model.updateState('testsession', null, {'testkey':'newtestvalue'}, 'testurl');
				expect(change_callback.callCount).toEqual(3);
				model.unbind('change:' + 'testkey', change_callback);
			});
		});
	});
}).call(this);