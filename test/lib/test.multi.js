'use strict';

var nodeCache = require('../../lib/cache-lib/node-cache');
var MultiCache = require('../..');
var assert = require('assert');
var _ = require('lodash');
var sinon = require('sinon');

var integration = [
  ['node-cache', 'node-cache'],
  ['node-cache', 'redis'],
  ['redis', 'node-cache']
  // ['redis', 'redis'] - this test wouldn't make sense because
  // we're reading/writing from/to the same "namespace"
];

var unit = [['node-cache', 'node-cache']];

var tests = process.env.NODE_MULTICACHE_TESTTYPE === 'integration' ?
  integration : unit;

tests.forEach(function(test){
  var key = 'myKey';
  var localCacheName = test[0],
    remoteCacheName = test[1];
  describe('Multi Cache', function(){
    var testRemoteOnly,
        testLocalOnly,
        testBothActive,
        testBothInactive;
    before(function(){
      testRemoteOnly = {
        useLocalCache: false,
        useRemoteCache: true
      };
      testLocalOnly = {
        useLocalCache: true,
        useRemoteCache: false
      };
      testBothActive = {
        useLocalCache: true,
        useRemoteCache: true
      };
      testBothInactive = {
        useLocalCache: false,
        useRemoteCache: false
      };
    });

    describe('Class creation', function() {

      it('should create a Multi-Cache without options', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        assert.notEqual(multiCache.localCache, multiCache.remoteCache);
        assert(multiCache.useLocalCacheDefault);
        assert(multiCache.useRemoteCacheDefault);
        // TODO: Add sinon to confirm that the createCache function is called.
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(result);
          multiCache.get(key, function (err, value) {
            assert(!err);
            assert.equal(value, 'myValue');
            // Test that key/value is in remoteCache as well because if
            // we create the Multi Cache without options then both remote
            // and local are switched on by default.
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(!err);
              assert.equal(value, 'myValue');
              done();
            });
          });
        });
      });

      it('should create a Multi-Cache with pre-created caches', function (done) {
        // Pass in pre-created cache objects to create a Multi-Cache instead of
        // names for the cache objects.
        var localCache = nodeCache();
        var remoteCache = nodeCache();

        var multiCache = new MultiCache(localCache, remoteCache, testLocalOnly);
        // TODO: Add sinon to confirm that the createCache function is NOT called.
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, testLocalOnly, function (err, value) {
            assert(!err);
            assert.equal(value, 'myValue');
            multiCache.get(key, testRemoteOnly, function(err, value){
              assert(err);
              assert(err.keyNotFound);
              assert.equal(undefined, value);
              done();
            });
          });
        });
      });


    });

    describe('Setting', function() {
      beforeEach(function(done){
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        multiCache.del(key, function(err){
          assert(!err);
          done();
        });
      });

      it('should set an object in the local cache only', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testLocalOnly);
        assert.notEqual(multiCache.localCache, multiCache.remoteCache);
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, function (err, value) {
            assert(!err);
            assert.equal(value, 'myValue');
            // Test that key/value is not in remoteCache
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(err);
              assert(err.keyNotFound);
              assert.equal(undefined, value);
              done();
            });
          });
        });
      });

      it('should set an object in the remote cache only', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testRemoteOnly);
        assert.notEqual(multiCache.localCache, multiCache.remoteCache);
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, testLocalOnly, function (err, value) {
            assert(err);
            assert(err.keyNotFound);
            assert.equal(undefined, value);
            // Test that key/value is in remoteCache
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(!err);
              assert(!_.isEmpty(value));
              done();
            });
          });
        });
      });

      it('should set an object in both remote and local caches', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testBothActive);
        assert.notEqual(multiCache.localCache, multiCache.remoteCache);
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, testLocalOnly, function (err, value) {
            assert(!err);
            assert(!_.isEmpty(value));
            // Test that key/value is in remoteCache
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(!err);
              assert(!_.isEmpty(value));
              done();
            });
          });
        });
      });

      it('should set with two params on set()', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testBothActive);
        multiCache.set(key, 'myValue');
        // .set() is async so wait for 500ms before testing that the value
        // has been set. We're doing this test to check the "else" branch
        // in the target code.
        setTimeout(function() {
          multiCache.get(key, testLocalOnly, function (err, value) {
            assert(!err);
            assert(!_.isEmpty(value));
            assert.equal(value, 'myValue');
            // Test that key/value is in remoteCache
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(!err);
              assert(!_.isEmpty(value));
              assert.equal(value, 'myValue');
              done();
            });
          });
        }, 500);
      });

      it('should throw with no callback and no caches on set()', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testBothInactive);
        try {
          multiCache.set(key, 'myValue');
        } catch(e) {
          assert.equal('local or remote must be specified when setting to cache', e.message);
          done();
        }
      });

      it('should return an error for neither caches during set', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testBothInactive);
        assert.notEqual(multiCache.localCache, multiCache.remoteCache);
        multiCache.set(key, 'myValue', function (err, result) {
          assert(err);
          assert(result === undefined);
          assert.equal('local or remote must be specified when setting to cache', err.message);
          done();
        });
      });

      it('should return an error for neither caches during get', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testBothActive);
        assert.notEqual(multiCache.localCache, multiCache.remoteCache);
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, testBothInactive, function (err, value) {
            assert(typeof err === 'object');
            assert.equal(undefined, value);
            assert.equal('local or remote must be specified when getting from cache', err.message);
            done();
          });
        });
      });

    });

    describe('Disabled', function() {

      it('should noop on set when disabled with callback', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, {disabled: true});
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert.equal(undefined, result);
          done();
        });
      });

      it('should noop on set when disabled without callback', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, {disabled: true});
        multiCache.set(key, 'myValue');
        setTimeout(function() {
          multiCache.get(key, function (err, value) {
            assert(err);
            assert.equal(err.name, 'MultiError');
            assert(err.keyNotFound);
            assert.equal(undefined, value);
            done();
          });
        }, 500);
      });

      it('should noop on del when disabled', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, {disabled: true});
        multiCache.del(key, function (err, result) {
          assert.equal(undefined, err);
          assert.equal(undefined, result);
          done();
        });
      });

    });

    describe('Getting', function() {
      beforeEach(function(done){
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        multiCache.del(key, function(err){
          assert(!err);
          done();
        });
      });

      it('should get an object from the remote cache if local is empty', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        multiCache.set(key, 'myValue', testRemoteOnly, function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, function (err, value) {
            assert(!err);
            assert.equal(value, 'myValue');
            // Confirm that key is not in local cache
            multiCache.get(key, testLocalOnly, function (err, value) {
              assert(err);
              assert(err.keyNotFound);
              assert.equal(undefined, value);
              done();
            });
          });
        });
      });

      it('should set an object in local cache if setLocal is true', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        multiCache.set(key, 'myValue', testRemoteOnly, function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, {setLocal: true}, function (err, value) {
            assert(!err);
            assert.equal(value, 'myValue');
            // Confirm that key is now also in local cache
            multiCache.get(key, testLocalOnly, function (err, value) {
              assert(!err);
              assert(!_.isEmpty(value));
              done();
            });
          });
        });
      });

      it('should handle the local cache returning an error on get', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testBothActive);
        var localStub = sinon.stub(multiCache.localCache, 'get', function(keys, callback){
          return callback('fake error', 'fake value');
        });
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, function (err, value) {
            assert.equal('fake error', err);
            assert.equal('fake value', value);
            localStub.restore();
            done();
          });
        });
      });

      it('should handle the remote cache returning an error on get', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName, testBothActive);
        var remoteStub = sinon.stub(multiCache.remoteCache, 'get', function(keys, callback){
          return callback('fake error', 'fake value');
        });
        multiCache.set(key, 'myValue', testRemoteOnly, function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          multiCache.get(key, function (err, value) {
            assert.equal('fake error', err);
            assert.equal('fake value', value);
            remoteStub.restore();
            done();
          });
        });
      });

    });

    describe('Deleting', function() {

      it('should delete an object in the local cache only', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        // Set a key/value in both local and remote caches
        // Set remoteCache to true to override the default from above
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(result);
          multiCache.del(key, testLocalOnly, function (err) {
            assert(!err);
            // Check that key has been deleted from local cache but not
            // from remote cache
            multiCache.get(key, testLocalOnly, function (err, value) {
              assert(err);
              assert(err.keyNotFound);
              assert.equal(undefined, value);
              multiCache.get(key, testRemoteOnly, function (err, value) {
                assert(!err);
                assert.equal('myValue', value);
                done();
              });
            });
          });
        });
      });

      it('should delete an object in the remote cache only', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        // Set a key/value in both local and remote caches
        // Set remoteCache to true to override the default from above
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(result);
          multiCache.del(key, testRemoteOnly, function (err) {
            assert(!err);
            // Check that key has been deleted from local cache but not
            // from remote cache
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(err);
              assert(err.keyNotFound);
              assert.equal(undefined, value);
              multiCache.get(key, testLocalOnly, function (err, value) {
                assert(!err);
                assert(!_.isEmpty(value));
                done();
              });
            });
          });
        });
      });

      it('should delete an object in both remote and local caches', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        // Set a key/value in both local and remote caches
        // Set remoteCache to true to override the default from above
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(result);
          multiCache.del(key, function (err) {
            assert(!err);
            // Check that key has been deleted from both caches
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(err);
              assert(err.keyNotFound);
              assert.equal(undefined, value);
              multiCache.get(key, testLocalOnly, function (err, value) {
                assert(err);
                assert(err.keyNotFound);
                assert.equal(undefined, value);
                done();
              });
            });
          });
        });
      });

      it('should not delete an object in either remote and local caches', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        // Set a key/value in both local and remote caches
        // Set remoteCache to true to override the default from above
        multiCache.set(key, 'myValue', function (err, result) {
          assert(!err);
          assert(result);
          multiCache.del(key, testBothInactive, function (err) {
            assert(!err);
            // Check that key has been deleted from local cache but not
            // from remote cache
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(!err);
              assert(!_.isEmpty(value));
              multiCache.get(key, testLocalOnly, function (err, value) {
                assert(!err);
                assert(!_.isEmpty(value));
                done();
              });
            });
          });
        });
      });
    });

    describe('Complex objects', function() {

      it('should set and get complex objects', function (done) {
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        var value = {
          nested: {
            obj: {
              which: {
                keeps: {
                  getting: {
                    deeper: {
                      and: {
                        deeper: {
                          and: {
                            has: {
                              an: {
                                array: {
                                  inside: {
                                    it: [
                                      1,
                                      1,
                                      2,
                                      6,
                                      24,
                                      {an: 'object'},
                                      'a string',
                                      new Date(),
                                      true,
                                      false
                                    ],
                                    and: {
                                      a: {
                                        date: new Date()
                                      }
                                    },
                                    a: {
                                      number: 1234
                                    },
                                    bool: true,
                                    string: 'another string'
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        };
        // Test that the cache returns the same complex object as what was set
        multiCache.set(key, value, testBothActive, function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          // Confirm value from local cache
          multiCache.get(key, testLocalOnly, function (err, result) {
            assert(!err);
            assert.deepEqual(result, value);
            // Confirm value from remote cache
            multiCache.get(key, testRemoteOnly, function (err, result) {
              assert(!err);
              assert.deepEqual(result, value);
              done();
            });
          });
        });
      });
    });

    describe('Cache Expiration', function(){
      it('should evict from cache based on TTL', function (done) {
        this.timeout(3000);
        var multiCache = new MultiCache(localCacheName, remoteCacheName);
        var ttl = 1; // seconds
        multiCache.set(key, 'myValue', ttl, function (err, result) {
          assert(!err);
          assert(!_.isEmpty(result));
          // Check that key is in both local and remote cache
          multiCache.get(key, testLocalOnly, function (err, value) {
            assert(!err);
            assert(!_.isEmpty(value));
            assert.equal(value, 'myValue');
            multiCache.get(key, testRemoteOnly, function (err, value) {
              assert(!err);
              assert(!_.isEmpty(value));
              assert.equal(value, 'myValue');
              // Test that key/value is evicted after 3 seconds
              setTimeout(function () {
                multiCache.get(key, testLocalOnly, function (err, value) {
                  assert(err);
                  assert(err.keyNotFound);
                  assert.equal(undefined, value);
                  multiCache.get(key, testRemoteOnly, function (err, value) {
                    assert(err);
                    assert(err.keyNotFound);
                    assert.equal(undefined, value);
                    done();
                  });
                });
              }, 2000);
            });
          });
        });
      });
    });
  });
});
