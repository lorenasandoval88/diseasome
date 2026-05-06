var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function commonjsRequire(path) {
	throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}

var localforage$1 = {exports: {}};

/*!
    localForage -- Offline Storage, Improved
    Version 1.10.0
    https://localforage.github.io/localForage
    (c) 2013-2017 Mozilla, Apache License 2.0
*/

var hasRequiredLocalforage;

function requireLocalforage () {
	if (hasRequiredLocalforage) return localforage$1.exports;
	hasRequiredLocalforage = 1;
	(function (module, exports$1) {
		(function(f){{module.exports=f();}})(function(){return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof commonjsRequire=="function"&&commonjsRequire;if(!u&&a)return a(o,true);if(i)return i(o,true);var f=new Error("Cannot find module '"+o+"'");throw (f.code="MODULE_NOT_FOUND", f)}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r);}return n[o].exports}var i=typeof commonjsRequire=="function"&&commonjsRequire;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports$1){
		(function (global){
		var Mutation = global.MutationObserver || global.WebKitMutationObserver;

		var scheduleDrain;

		{
		  if (Mutation) {
		    var called = 0;
		    var observer = new Mutation(nextTick);
		    var element = global.document.createTextNode('');
		    observer.observe(element, {
		      characterData: true
		    });
		    scheduleDrain = function () {
		      element.data = (called = ++called % 2);
		    };
		  } else if (!global.setImmediate && typeof global.MessageChannel !== 'undefined') {
		    var channel = new global.MessageChannel();
		    channel.port1.onmessage = nextTick;
		    scheduleDrain = function () {
		      channel.port2.postMessage(0);
		    };
		  } else if ('document' in global && 'onreadystatechange' in global.document.createElement('script')) {
		    scheduleDrain = function () {

		      // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
		      // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
		      var scriptEl = global.document.createElement('script');
		      scriptEl.onreadystatechange = function () {
		        nextTick();

		        scriptEl.onreadystatechange = null;
		        scriptEl.parentNode.removeChild(scriptEl);
		        scriptEl = null;
		      };
		      global.document.documentElement.appendChild(scriptEl);
		    };
		  } else {
		    scheduleDrain = function () {
		      setTimeout(nextTick, 0);
		    };
		  }
		}

		var draining;
		var queue = [];
		//named nextTick for less confusing stack traces
		function nextTick() {
		  draining = true;
		  var i, oldQueue;
		  var len = queue.length;
		  while (len) {
		    oldQueue = queue;
		    queue = [];
		    i = -1;
		    while (++i < len) {
		      oldQueue[i]();
		    }
		    len = queue.length;
		  }
		  draining = false;
		}

		module.exports = immediate;
		function immediate(task) {
		  if (queue.push(task) === 1 && !draining) {
		    scheduleDrain();
		  }
		}

		}).call(this,typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
		},{}],2:[function(_dereq_,module,exports$1){
		var immediate = _dereq_(1);

		/* istanbul ignore next */
		function INTERNAL() {}

		var handlers = {};

		var REJECTED = ['REJECTED'];
		var FULFILLED = ['FULFILLED'];
		var PENDING = ['PENDING'];

		module.exports = Promise;

		function Promise(resolver) {
		  if (typeof resolver !== 'function') {
		    throw new TypeError('resolver must be a function');
		  }
		  this.state = PENDING;
		  this.queue = [];
		  this.outcome = void 0;
		  if (resolver !== INTERNAL) {
		    safelyResolveThenable(this, resolver);
		  }
		}

		Promise.prototype["catch"] = function (onRejected) {
		  return this.then(null, onRejected);
		};
		Promise.prototype.then = function (onFulfilled, onRejected) {
		  if (typeof onFulfilled !== 'function' && this.state === FULFILLED ||
		    typeof onRejected !== 'function' && this.state === REJECTED) {
		    return this;
		  }
		  var promise = new this.constructor(INTERNAL);
		  if (this.state !== PENDING) {
		    var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
		    unwrap(promise, resolver, this.outcome);
		  } else {
		    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
		  }

		  return promise;
		};
		function QueueItem(promise, onFulfilled, onRejected) {
		  this.promise = promise;
		  if (typeof onFulfilled === 'function') {
		    this.onFulfilled = onFulfilled;
		    this.callFulfilled = this.otherCallFulfilled;
		  }
		  if (typeof onRejected === 'function') {
		    this.onRejected = onRejected;
		    this.callRejected = this.otherCallRejected;
		  }
		}
		QueueItem.prototype.callFulfilled = function (value) {
		  handlers.resolve(this.promise, value);
		};
		QueueItem.prototype.otherCallFulfilled = function (value) {
		  unwrap(this.promise, this.onFulfilled, value);
		};
		QueueItem.prototype.callRejected = function (value) {
		  handlers.reject(this.promise, value);
		};
		QueueItem.prototype.otherCallRejected = function (value) {
		  unwrap(this.promise, this.onRejected, value);
		};

		function unwrap(promise, func, value) {
		  immediate(function () {
		    var returnValue;
		    try {
		      returnValue = func(value);
		    } catch (e) {
		      return handlers.reject(promise, e);
		    }
		    if (returnValue === promise) {
		      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
		    } else {
		      handlers.resolve(promise, returnValue);
		    }
		  });
		}

		handlers.resolve = function (self, value) {
		  var result = tryCatch(getThen, value);
		  if (result.status === 'error') {
		    return handlers.reject(self, result.value);
		  }
		  var thenable = result.value;

		  if (thenable) {
		    safelyResolveThenable(self, thenable);
		  } else {
		    self.state = FULFILLED;
		    self.outcome = value;
		    var i = -1;
		    var len = self.queue.length;
		    while (++i < len) {
		      self.queue[i].callFulfilled(value);
		    }
		  }
		  return self;
		};
		handlers.reject = function (self, error) {
		  self.state = REJECTED;
		  self.outcome = error;
		  var i = -1;
		  var len = self.queue.length;
		  while (++i < len) {
		    self.queue[i].callRejected(error);
		  }
		  return self;
		};

		function getThen(obj) {
		  // Make sure we only access the accessor once as required by the spec
		  var then = obj && obj.then;
		  if (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof then === 'function') {
		    return function appyThen() {
		      then.apply(obj, arguments);
		    };
		  }
		}

		function safelyResolveThenable(self, thenable) {
		  // Either fulfill, reject or reject with error
		  var called = false;
		  function onError(value) {
		    if (called) {
		      return;
		    }
		    called = true;
		    handlers.reject(self, value);
		  }

		  function onSuccess(value) {
		    if (called) {
		      return;
		    }
		    called = true;
		    handlers.resolve(self, value);
		  }

		  function tryToUnwrap() {
		    thenable(onSuccess, onError);
		  }

		  var result = tryCatch(tryToUnwrap);
		  if (result.status === 'error') {
		    onError(result.value);
		  }
		}

		function tryCatch(func, value) {
		  var out = {};
		  try {
		    out.value = func(value);
		    out.status = 'success';
		  } catch (e) {
		    out.status = 'error';
		    out.value = e;
		  }
		  return out;
		}

		Promise.resolve = resolve;
		function resolve(value) {
		  if (value instanceof this) {
		    return value;
		  }
		  return handlers.resolve(new this(INTERNAL), value);
		}

		Promise.reject = reject;
		function reject(reason) {
		  var promise = new this(INTERNAL);
		  return handlers.reject(promise, reason);
		}

		Promise.all = all;
		function all(iterable) {
		  var self = this;
		  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
		    return this.reject(new TypeError('must be an array'));
		  }

		  var len = iterable.length;
		  var called = false;
		  if (!len) {
		    return this.resolve([]);
		  }

		  var values = new Array(len);
		  var resolved = 0;
		  var i = -1;
		  var promise = new this(INTERNAL);

		  while (++i < len) {
		    allResolver(iterable[i], i);
		  }
		  return promise;
		  function allResolver(value, i) {
		    self.resolve(value).then(resolveFromAll, function (error) {
		      if (!called) {
		        called = true;
		        handlers.reject(promise, error);
		      }
		    });
		    function resolveFromAll(outValue) {
		      values[i] = outValue;
		      if (++resolved === len && !called) {
		        called = true;
		        handlers.resolve(promise, values);
		      }
		    }
		  }
		}

		Promise.race = race;
		function race(iterable) {
		  var self = this;
		  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
		    return this.reject(new TypeError('must be an array'));
		  }

		  var len = iterable.length;
		  var called = false;
		  if (!len) {
		    return this.resolve([]);
		  }

		  var i = -1;
		  var promise = new this(INTERNAL);

		  while (++i < len) {
		    resolver(iterable[i]);
		  }
		  return promise;
		  function resolver(value) {
		    self.resolve(value).then(function (response) {
		      if (!called) {
		        called = true;
		        handlers.resolve(promise, response);
		      }
		    }, function (error) {
		      if (!called) {
		        called = true;
		        handlers.reject(promise, error);
		      }
		    });
		  }
		}

		},{"1":1}],3:[function(_dereq_,module,exports$1){
		(function (global){
		if (typeof global.Promise !== 'function') {
		  global.Promise = _dereq_(2);
		}

		}).call(this,typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
		},{"2":2}],4:[function(_dereq_,module,exports$1){

		var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

		function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

		function getIDB() {
		    /* global indexedDB,webkitIndexedDB,mozIndexedDB,OIndexedDB,msIndexedDB */
		    try {
		        if (typeof indexedDB !== 'undefined') {
		            return indexedDB;
		        }
		        if (typeof webkitIndexedDB !== 'undefined') {
		            return webkitIndexedDB;
		        }
		        if (typeof mozIndexedDB !== 'undefined') {
		            return mozIndexedDB;
		        }
		        if (typeof OIndexedDB !== 'undefined') {
		            return OIndexedDB;
		        }
		        if (typeof msIndexedDB !== 'undefined') {
		            return msIndexedDB;
		        }
		    } catch (e) {
		        return;
		    }
		}

		var idb = getIDB();

		function isIndexedDBValid() {
		    try {
		        // Initialize IndexedDB; fall back to vendor-prefixed versions
		        // if needed.
		        if (!idb || !idb.open) {
		            return false;
		        }
		        // We mimic PouchDB here;
		        //
		        // We test for openDatabase because IE Mobile identifies itself
		        // as Safari. Oh the lulz...
		        var isSafari = typeof openDatabase !== 'undefined' && /(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/BlackBerry/.test(navigator.platform);

		        var hasFetch = typeof fetch === 'function' && fetch.toString().indexOf('[native code') !== -1;

		        // Safari <10.1 does not meet our requirements for IDB support
		        // (see: https://github.com/pouchdb/pouchdb/issues/5572).
		        // Safari 10.1 shipped with fetch, we can use that to detect it.
		        // Note: this creates issues with `window.fetch` polyfills and
		        // overrides; see:
		        // https://github.com/localForage/localForage/issues/856
		        return (!isSafari || hasFetch) && typeof indexedDB !== 'undefined' &&
		        // some outdated implementations of IDB that appear on Samsung
		        // and HTC Android devices <4.4 are missing IDBKeyRange
		        // See: https://github.com/mozilla/localForage/issues/128
		        // See: https://github.com/mozilla/localForage/issues/272
		        typeof IDBKeyRange !== 'undefined';
		    } catch (e) {
		        return false;
		    }
		}

		// Abstracts constructing a Blob object, so it also works in older
		// browsers that don't support the native Blob constructor. (i.e.
		// old QtWebKit versions, at least).
		// Abstracts constructing a Blob object, so it also works in older
		// browsers that don't support the native Blob constructor. (i.e.
		// old QtWebKit versions, at least).
		function createBlob(parts, properties) {
		    /* global BlobBuilder,MSBlobBuilder,MozBlobBuilder,WebKitBlobBuilder */
		    parts = parts || [];
		    properties = properties || {};
		    try {
		        return new Blob(parts, properties);
		    } catch (e) {
		        if (e.name !== 'TypeError') {
		            throw e;
		        }
		        var Builder = typeof BlobBuilder !== 'undefined' ? BlobBuilder : typeof MSBlobBuilder !== 'undefined' ? MSBlobBuilder : typeof MozBlobBuilder !== 'undefined' ? MozBlobBuilder : WebKitBlobBuilder;
		        var builder = new Builder();
		        for (var i = 0; i < parts.length; i += 1) {
		            builder.append(parts[i]);
		        }
		        return builder.getBlob(properties.type);
		    }
		}

		// This is CommonJS because lie is an external dependency, so Rollup
		// can just ignore it.
		if (typeof Promise === 'undefined') {
		    // In the "nopromises" build this will just throw if you don't have
		    // a global promise object, but it would throw anyway later.
		    _dereq_(3);
		}
		var Promise$1 = Promise;

		function executeCallback(promise, callback) {
		    if (callback) {
		        promise.then(function (result) {
		            callback(null, result);
		        }, function (error) {
		            callback(error);
		        });
		    }
		}

		function executeTwoCallbacks(promise, callback, errorCallback) {
		    if (typeof callback === 'function') {
		        promise.then(callback);
		    }

		    if (typeof errorCallback === 'function') {
		        promise["catch"](errorCallback);
		    }
		}

		function normalizeKey(key) {
		    // Cast the key to a string, as that's all we can set as a key.
		    if (typeof key !== 'string') {
		        console.warn(key + ' used as a key, but it is not a string.');
		        key = String(key);
		    }

		    return key;
		}

		function getCallback() {
		    if (arguments.length && typeof arguments[arguments.length - 1] === 'function') {
		        return arguments[arguments.length - 1];
		    }
		}

		// Some code originally from async_storage.js in
		// [Gaia](https://github.com/mozilla-b2g/gaia).

		var DETECT_BLOB_SUPPORT_STORE = 'local-forage-detect-blob-support';
		var supportsBlobs = void 0;
		var dbContexts = {};
		var toString = Object.prototype.toString;

		// Transaction Modes
		var READ_ONLY = 'readonly';
		var READ_WRITE = 'readwrite';

		// Transform a binary string to an array buffer, because otherwise
		// weird stuff happens when you try to work with the binary string directly.
		// It is known.
		// From http://stackoverflow.com/questions/14967647/ (continues on next line)
		// encode-decode-image-with-base64-breaks-image (2013-04-21)
		function _binStringToArrayBuffer(bin) {
		    var length = bin.length;
		    var buf = new ArrayBuffer(length);
		    var arr = new Uint8Array(buf);
		    for (var i = 0; i < length; i++) {
		        arr[i] = bin.charCodeAt(i);
		    }
		    return buf;
		}

		//
		// Blobs are not supported in all versions of IndexedDB, notably
		// Chrome <37 and Android <5. In those versions, storing a blob will throw.
		//
		// Various other blob bugs exist in Chrome v37-42 (inclusive).
		// Detecting them is expensive and confusing to users, and Chrome 37-42
		// is at very low usage worldwide, so we do a hacky userAgent check instead.
		//
		// content-type bug: https://code.google.com/p/chromium/issues/detail?id=408120
		// 404 bug: https://code.google.com/p/chromium/issues/detail?id=447916
		// FileReader bug: https://code.google.com/p/chromium/issues/detail?id=447836
		//
		// Code borrowed from PouchDB. See:
		// https://github.com/pouchdb/pouchdb/blob/master/packages/node_modules/pouchdb-adapter-idb/src/blobSupport.js
		//
		function _checkBlobSupportWithoutCaching(idb) {
		    return new Promise$1(function (resolve) {
		        var txn = idb.transaction(DETECT_BLOB_SUPPORT_STORE, READ_WRITE);
		        var blob = createBlob(['']);
		        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');

		        txn.onabort = function (e) {
		            // If the transaction aborts now its due to not being able to
		            // write to the database, likely due to the disk being full
		            e.preventDefault();
		            e.stopPropagation();
		            resolve(false);
		        };

		        txn.oncomplete = function () {
		            var matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
		            var matchedEdge = navigator.userAgent.match(/Edge\//);
		            // MS Edge pretends to be Chrome 42:
		            // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
		            resolve(matchedEdge || !matchedChrome || parseInt(matchedChrome[1], 10) >= 43);
		        };
		    })["catch"](function () {
		        return false; // error, so assume unsupported
		    });
		}

		function _checkBlobSupport(idb) {
		    if (typeof supportsBlobs === 'boolean') {
		        return Promise$1.resolve(supportsBlobs);
		    }
		    return _checkBlobSupportWithoutCaching(idb).then(function (value) {
		        supportsBlobs = value;
		        return supportsBlobs;
		    });
		}

		function _deferReadiness(dbInfo) {
		    var dbContext = dbContexts[dbInfo.name];

		    // Create a deferred object representing the current database operation.
		    var deferredOperation = {};

		    deferredOperation.promise = new Promise$1(function (resolve, reject) {
		        deferredOperation.resolve = resolve;
		        deferredOperation.reject = reject;
		    });

		    // Enqueue the deferred operation.
		    dbContext.deferredOperations.push(deferredOperation);

		    // Chain its promise to the database readiness.
		    if (!dbContext.dbReady) {
		        dbContext.dbReady = deferredOperation.promise;
		    } else {
		        dbContext.dbReady = dbContext.dbReady.then(function () {
		            return deferredOperation.promise;
		        });
		    }
		}

		function _advanceReadiness(dbInfo) {
		    var dbContext = dbContexts[dbInfo.name];

		    // Dequeue a deferred operation.
		    var deferredOperation = dbContext.deferredOperations.pop();

		    // Resolve its promise (which is part of the database readiness
		    // chain of promises).
		    if (deferredOperation) {
		        deferredOperation.resolve();
		        return deferredOperation.promise;
		    }
		}

		function _rejectReadiness(dbInfo, err) {
		    var dbContext = dbContexts[dbInfo.name];

		    // Dequeue a deferred operation.
		    var deferredOperation = dbContext.deferredOperations.pop();

		    // Reject its promise (which is part of the database readiness
		    // chain of promises).
		    if (deferredOperation) {
		        deferredOperation.reject(err);
		        return deferredOperation.promise;
		    }
		}

		function _getConnection(dbInfo, upgradeNeeded) {
		    return new Promise$1(function (resolve, reject) {
		        dbContexts[dbInfo.name] = dbContexts[dbInfo.name] || createDbContext();

		        if (dbInfo.db) {
		            if (upgradeNeeded) {
		                _deferReadiness(dbInfo);
		                dbInfo.db.close();
		            } else {
		                return resolve(dbInfo.db);
		            }
		        }

		        var dbArgs = [dbInfo.name];

		        if (upgradeNeeded) {
		            dbArgs.push(dbInfo.version);
		        }

		        var openreq = idb.open.apply(idb, dbArgs);

		        if (upgradeNeeded) {
		            openreq.onupgradeneeded = function (e) {
		                var db = openreq.result;
		                try {
		                    db.createObjectStore(dbInfo.storeName);
		                    if (e.oldVersion <= 1) {
		                        // Added when support for blob shims was added
		                        db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
		                    }
		                } catch (ex) {
		                    if (ex.name === 'ConstraintError') {
		                        console.warn('The database "' + dbInfo.name + '"' + ' has been upgraded from version ' + e.oldVersion + ' to version ' + e.newVersion + ', but the storage "' + dbInfo.storeName + '" already exists.');
		                    } else {
		                        throw ex;
		                    }
		                }
		            };
		        }

		        openreq.onerror = function (e) {
		            e.preventDefault();
		            reject(openreq.error);
		        };

		        openreq.onsuccess = function () {
		            var db = openreq.result;
		            db.onversionchange = function (e) {
		                // Triggered when the database is modified (e.g. adding an objectStore) or
		                // deleted (even when initiated by other sessions in different tabs).
		                // Closing the connection here prevents those operations from being blocked.
		                // If the database is accessed again later by this instance, the connection
		                // will be reopened or the database recreated as needed.
		                e.target.close();
		            };
		            resolve(db);
		            _advanceReadiness(dbInfo);
		        };
		    });
		}

		function _getOriginalConnection(dbInfo) {
		    return _getConnection(dbInfo, false);
		}

		function _getUpgradedConnection(dbInfo) {
		    return _getConnection(dbInfo, true);
		}

		function _isUpgradeNeeded(dbInfo, defaultVersion) {
		    if (!dbInfo.db) {
		        return true;
		    }

		    var isNewStore = !dbInfo.db.objectStoreNames.contains(dbInfo.storeName);
		    var isDowngrade = dbInfo.version < dbInfo.db.version;
		    var isUpgrade = dbInfo.version > dbInfo.db.version;

		    if (isDowngrade) {
		        // If the version is not the default one
		        // then warn for impossible downgrade.
		        if (dbInfo.version !== defaultVersion) {
		            console.warn('The database "' + dbInfo.name + '"' + " can't be downgraded from version " + dbInfo.db.version + ' to version ' + dbInfo.version + '.');
		        }
		        // Align the versions to prevent errors.
		        dbInfo.version = dbInfo.db.version;
		    }

		    if (isUpgrade || isNewStore) {
		        // If the store is new then increment the version (if needed).
		        // This will trigger an "upgradeneeded" event which is required
		        // for creating a store.
		        if (isNewStore) {
		            var incVersion = dbInfo.db.version + 1;
		            if (incVersion > dbInfo.version) {
		                dbInfo.version = incVersion;
		            }
		        }

		        return true;
		    }

		    return false;
		}

		// encode a blob for indexeddb engines that don't support blobs
		function _encodeBlob(blob) {
		    return new Promise$1(function (resolve, reject) {
		        var reader = new FileReader();
		        reader.onerror = reject;
		        reader.onloadend = function (e) {
		            var base64 = btoa(e.target.result || '');
		            resolve({
		                __local_forage_encoded_blob: true,
		                data: base64,
		                type: blob.type
		            });
		        };
		        reader.readAsBinaryString(blob);
		    });
		}

		// decode an encoded blob
		function _decodeBlob(encodedBlob) {
		    var arrayBuff = _binStringToArrayBuffer(atob(encodedBlob.data));
		    return createBlob([arrayBuff], { type: encodedBlob.type });
		}

		// is this one of our fancy encoded blobs?
		function _isEncodedBlob(value) {
		    return value && value.__local_forage_encoded_blob;
		}

		// Specialize the default `ready()` function by making it dependent
		// on the current database operations. Thus, the driver will be actually
		// ready when it's been initialized (default) *and* there are no pending
		// operations on the database (initiated by some other instances).
		function _fullyReady(callback) {
		    var self = this;

		    var promise = self._initReady().then(function () {
		        var dbContext = dbContexts[self._dbInfo.name];

		        if (dbContext && dbContext.dbReady) {
		            return dbContext.dbReady;
		        }
		    });

		    executeTwoCallbacks(promise, callback, callback);
		    return promise;
		}

		// Try to establish a new db connection to replace the
		// current one which is broken (i.e. experiencing
		// InvalidStateError while creating a transaction).
		function _tryReconnect(dbInfo) {
		    _deferReadiness(dbInfo);

		    var dbContext = dbContexts[dbInfo.name];
		    var forages = dbContext.forages;

		    for (var i = 0; i < forages.length; i++) {
		        var forage = forages[i];
		        if (forage._dbInfo.db) {
		            forage._dbInfo.db.close();
		            forage._dbInfo.db = null;
		        }
		    }
		    dbInfo.db = null;

		    return _getOriginalConnection(dbInfo).then(function (db) {
		        dbInfo.db = db;
		        if (_isUpgradeNeeded(dbInfo)) {
		            // Reopen the database for upgrading.
		            return _getUpgradedConnection(dbInfo);
		        }
		        return db;
		    }).then(function (db) {
		        // store the latest db reference
		        // in case the db was upgraded
		        dbInfo.db = dbContext.db = db;
		        for (var i = 0; i < forages.length; i++) {
		            forages[i]._dbInfo.db = db;
		        }
		    })["catch"](function (err) {
		        _rejectReadiness(dbInfo, err);
		        throw err;
		    });
		}

		// FF doesn't like Promises (micro-tasks) and IDDB store operations,
		// so we have to do it with callbacks
		function createTransaction(dbInfo, mode, callback, retries) {
		    if (retries === undefined) {
		        retries = 1;
		    }

		    try {
		        var tx = dbInfo.db.transaction(dbInfo.storeName, mode);
		        callback(null, tx);
		    } catch (err) {
		        if (retries > 0 && (!dbInfo.db || err.name === 'InvalidStateError' || err.name === 'NotFoundError')) {
		            return Promise$1.resolve().then(function () {
		                if (!dbInfo.db || err.name === 'NotFoundError' && !dbInfo.db.objectStoreNames.contains(dbInfo.storeName) && dbInfo.version <= dbInfo.db.version) {
		                    // increase the db version, to create the new ObjectStore
		                    if (dbInfo.db) {
		                        dbInfo.version = dbInfo.db.version + 1;
		                    }
		                    // Reopen the database for upgrading.
		                    return _getUpgradedConnection(dbInfo);
		                }
		            }).then(function () {
		                return _tryReconnect(dbInfo).then(function () {
		                    createTransaction(dbInfo, mode, callback, retries - 1);
		                });
		            })["catch"](callback);
		        }

		        callback(err);
		    }
		}

		function createDbContext() {
		    return {
		        // Running localForages sharing a database.
		        forages: [],
		        // Shared database.
		        db: null,
		        // Database readiness (promise).
		        dbReady: null,
		        // Deferred operations on the database.
		        deferredOperations: []
		    };
		}

		// Open the IndexedDB database (automatically creates one if one didn't
		// previously exist), using any options set in the config.
		function _initStorage(options) {
		    var self = this;
		    var dbInfo = {
		        db: null
		    };

		    if (options) {
		        for (var i in options) {
		            dbInfo[i] = options[i];
		        }
		    }

		    // Get the current context of the database;
		    var dbContext = dbContexts[dbInfo.name];

		    // ...or create a new context.
		    if (!dbContext) {
		        dbContext = createDbContext();
		        // Register the new context in the global container.
		        dbContexts[dbInfo.name] = dbContext;
		    }

		    // Register itself as a running localForage in the current context.
		    dbContext.forages.push(self);

		    // Replace the default `ready()` function with the specialized one.
		    if (!self._initReady) {
		        self._initReady = self.ready;
		        self.ready = _fullyReady;
		    }

		    // Create an array of initialization states of the related localForages.
		    var initPromises = [];

		    function ignoreErrors() {
		        // Don't handle errors here,
		        // just makes sure related localForages aren't pending.
		        return Promise$1.resolve();
		    }

		    for (var j = 0; j < dbContext.forages.length; j++) {
		        var forage = dbContext.forages[j];
		        if (forage !== self) {
		            // Don't wait for itself...
		            initPromises.push(forage._initReady()["catch"](ignoreErrors));
		        }
		    }

		    // Take a snapshot of the related localForages.
		    var forages = dbContext.forages.slice(0);

		    // Initialize the connection process only when
		    // all the related localForages aren't pending.
		    return Promise$1.all(initPromises).then(function () {
		        dbInfo.db = dbContext.db;
		        // Get the connection or open a new one without upgrade.
		        return _getOriginalConnection(dbInfo);
		    }).then(function (db) {
		        dbInfo.db = db;
		        if (_isUpgradeNeeded(dbInfo, self._defaultConfig.version)) {
		            // Reopen the database for upgrading.
		            return _getUpgradedConnection(dbInfo);
		        }
		        return db;
		    }).then(function (db) {
		        dbInfo.db = dbContext.db = db;
		        self._dbInfo = dbInfo;
		        // Share the final connection amongst related localForages.
		        for (var k = 0; k < forages.length; k++) {
		            var forage = forages[k];
		            if (forage !== self) {
		                // Self is already up-to-date.
		                forage._dbInfo.db = dbInfo.db;
		                forage._dbInfo.version = dbInfo.version;
		            }
		        }
		    });
		}

		function getItem(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.get(key);

		                    req.onsuccess = function () {
		                        var value = req.result;
		                        if (value === undefined) {
		                            value = null;
		                        }
		                        if (_isEncodedBlob(value)) {
		                            value = _decodeBlob(value);
		                        }
		                        resolve(value);
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Iterate over all items stored in database.
		function iterate(iterator, callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.openCursor();
		                    var iterationNumber = 1;

		                    req.onsuccess = function () {
		                        var cursor = req.result;

		                        if (cursor) {
		                            var value = cursor.value;
		                            if (_isEncodedBlob(value)) {
		                                value = _decodeBlob(value);
		                            }
		                            var result = iterator(value, cursor.key, iterationNumber++);

		                            // when the iterator callback returns any
		                            // (non-`undefined`) value, then we stop
		                            // the iteration immediately
		                            if (result !== void 0) {
		                                resolve(result);
		                            } else {
		                                cursor["continue"]();
		                            }
		                        } else {
		                            resolve();
		                        }
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);

		    return promise;
		}

		function setItem(key, value, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        var dbInfo;
		        self.ready().then(function () {
		            dbInfo = self._dbInfo;
		            if (toString.call(value) === '[object Blob]') {
		                return _checkBlobSupport(dbInfo.db).then(function (blobSupport) {
		                    if (blobSupport) {
		                        return value;
		                    }
		                    return _encodeBlob(value);
		                });
		            }
		            return value;
		        }).then(function (value) {
		            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);

		                    // The reason we don't _save_ null is because IE 10 does
		                    // not support saving the `null` type in IndexedDB. How
		                    // ironic, given the bug below!
		                    // See: https://github.com/mozilla/localForage/issues/161
		                    if (value === null) {
		                        value = undefined;
		                    }

		                    var req = store.put(value, key);

		                    transaction.oncomplete = function () {
		                        // Cast to undefined so the value passed to
		                        // callback/promise is the same as what one would get out
		                        // of `getItem()` later. This leads to some weirdness
		                        // (setItem('foo', undefined) will return `null`), but
		                        // it's not my fault localStorage is our baseline and that
		                        // it's weird.
		                        if (value === undefined) {
		                            value = null;
		                        }

		                        resolve(value);
		                    };
		                    transaction.onabort = transaction.onerror = function () {
		                        var err = req.error ? req.error : req.transaction.error;
		                        reject(err);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function removeItem(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    // We use a Grunt task to make this safe for IE and some
		                    // versions of Android (including those used by Cordova).
		                    // Normally IE won't like `.delete()` and will insist on
		                    // using `['delete']()`, but we have a build step that
		                    // fixes this for us now.
		                    var req = store["delete"](key);
		                    transaction.oncomplete = function () {
		                        resolve();
		                    };

		                    transaction.onerror = function () {
		                        reject(req.error);
		                    };

		                    // The request will be also be aborted if we've exceeded our storage
		                    // space.
		                    transaction.onabort = function () {
		                        var err = req.error ? req.error : req.transaction.error;
		                        reject(err);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function clear(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.clear();

		                    transaction.oncomplete = function () {
		                        resolve();
		                    };

		                    transaction.onabort = transaction.onerror = function () {
		                        var err = req.error ? req.error : req.transaction.error;
		                        reject(err);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function length(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.count();

		                    req.onsuccess = function () {
		                        resolve(req.result);
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function key(n, callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        if (n < 0) {
		            resolve(null);

		            return;
		        }

		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var advanced = false;
		                    var req = store.openKeyCursor();

		                    req.onsuccess = function () {
		                        var cursor = req.result;
		                        if (!cursor) {
		                            // this means there weren't enough keys
		                            resolve(null);

		                            return;
		                        }

		                        if (n === 0) {
		                            // We have the first key, return it if that's what they
		                            // wanted.
		                            resolve(cursor.key);
		                        } else {
		                            if (!advanced) {
		                                // Otherwise, ask the cursor to skip ahead n
		                                // records.
		                                advanced = true;
		                                cursor.advance(n);
		                            } else {
		                                // When we get here, we've got the nth key.
		                                resolve(cursor.key);
		                            }
		                        }
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function keys(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.openKeyCursor();
		                    var keys = [];

		                    req.onsuccess = function () {
		                        var cursor = req.result;

		                        if (!cursor) {
		                            resolve(keys);
		                            return;
		                        }

		                        keys.push(cursor.key);
		                        cursor["continue"]();
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function dropInstance(options, callback) {
		    callback = getCallback.apply(this, arguments);

		    var currentConfig = this.config();
		    options = typeof options !== 'function' && options || {};
		    if (!options.name) {
		        options.name = options.name || currentConfig.name;
		        options.storeName = options.storeName || currentConfig.storeName;
		    }

		    var self = this;
		    var promise;
		    if (!options.name) {
		        promise = Promise$1.reject('Invalid arguments');
		    } else {
		        var isCurrentDb = options.name === currentConfig.name && self._dbInfo.db;

		        var dbPromise = isCurrentDb ? Promise$1.resolve(self._dbInfo.db) : _getOriginalConnection(options).then(function (db) {
		            var dbContext = dbContexts[options.name];
		            var forages = dbContext.forages;
		            dbContext.db = db;
		            for (var i = 0; i < forages.length; i++) {
		                forages[i]._dbInfo.db = db;
		            }
		            return db;
		        });

		        if (!options.storeName) {
		            promise = dbPromise.then(function (db) {
		                _deferReadiness(options);

		                var dbContext = dbContexts[options.name];
		                var forages = dbContext.forages;

		                db.close();
		                for (var i = 0; i < forages.length; i++) {
		                    var forage = forages[i];
		                    forage._dbInfo.db = null;
		                }

		                var dropDBPromise = new Promise$1(function (resolve, reject) {
		                    var req = idb.deleteDatabase(options.name);

		                    req.onerror = function () {
		                        var db = req.result;
		                        if (db) {
		                            db.close();
		                        }
		                        reject(req.error);
		                    };

		                    req.onblocked = function () {
		                        // Closing all open connections in onversionchange handler should prevent this situation, but if
		                        // we do get here, it just means the request remains pending - eventually it will succeed or error
		                        console.warn('dropInstance blocked for database "' + options.name + '" until all open connections are closed');
		                    };

		                    req.onsuccess = function () {
		                        var db = req.result;
		                        if (db) {
		                            db.close();
		                        }
		                        resolve(db);
		                    };
		                });

		                return dropDBPromise.then(function (db) {
		                    dbContext.db = db;
		                    for (var i = 0; i < forages.length; i++) {
		                        var _forage = forages[i];
		                        _advanceReadiness(_forage._dbInfo);
		                    }
		                })["catch"](function (err) {
		                    (_rejectReadiness(options, err) || Promise$1.resolve())["catch"](function () {});
		                    throw err;
		                });
		            });
		        } else {
		            promise = dbPromise.then(function (db) {
		                if (!db.objectStoreNames.contains(options.storeName)) {
		                    return;
		                }

		                var newVersion = db.version + 1;

		                _deferReadiness(options);

		                var dbContext = dbContexts[options.name];
		                var forages = dbContext.forages;

		                db.close();
		                for (var i = 0; i < forages.length; i++) {
		                    var forage = forages[i];
		                    forage._dbInfo.db = null;
		                    forage._dbInfo.version = newVersion;
		                }

		                var dropObjectPromise = new Promise$1(function (resolve, reject) {
		                    var req = idb.open(options.name, newVersion);

		                    req.onerror = function (err) {
		                        var db = req.result;
		                        db.close();
		                        reject(err);
		                    };

		                    req.onupgradeneeded = function () {
		                        var db = req.result;
		                        db.deleteObjectStore(options.storeName);
		                    };

		                    req.onsuccess = function () {
		                        var db = req.result;
		                        db.close();
		                        resolve(db);
		                    };
		                });

		                return dropObjectPromise.then(function (db) {
		                    dbContext.db = db;
		                    for (var j = 0; j < forages.length; j++) {
		                        var _forage2 = forages[j];
		                        _forage2._dbInfo.db = db;
		                        _advanceReadiness(_forage2._dbInfo);
		                    }
		                })["catch"](function (err) {
		                    (_rejectReadiness(options, err) || Promise$1.resolve())["catch"](function () {});
		                    throw err;
		                });
		            });
		        }
		    }

		    executeCallback(promise, callback);
		    return promise;
		}

		var asyncStorage = {
		    _driver: 'asyncStorage',
		    _initStorage: _initStorage,
		    _support: isIndexedDBValid(),
		    iterate: iterate,
		    getItem: getItem,
		    setItem: setItem,
		    removeItem: removeItem,
		    clear: clear,
		    length: length,
		    key: key,
		    keys: keys,
		    dropInstance: dropInstance
		};

		function isWebSQLValid() {
		    return typeof openDatabase === 'function';
		}

		// Sadly, the best way to save binary data in WebSQL/localStorage is serializing
		// it to Base64, so this is how we store it to prevent very strange errors with less
		// verbose ways of binary <-> string data storage.
		var BASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

		var BLOB_TYPE_PREFIX = '~~local_forage_type~';
		var BLOB_TYPE_PREFIX_REGEX = /^~~local_forage_type~([^~]+)~/;

		var SERIALIZED_MARKER = '__lfsc__:';
		var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;

		// OMG the serializations!
		var TYPE_ARRAYBUFFER = 'arbf';
		var TYPE_BLOB = 'blob';
		var TYPE_INT8ARRAY = 'si08';
		var TYPE_UINT8ARRAY = 'ui08';
		var TYPE_UINT8CLAMPEDARRAY = 'uic8';
		var TYPE_INT16ARRAY = 'si16';
		var TYPE_INT32ARRAY = 'si32';
		var TYPE_UINT16ARRAY = 'ur16';
		var TYPE_UINT32ARRAY = 'ui32';
		var TYPE_FLOAT32ARRAY = 'fl32';
		var TYPE_FLOAT64ARRAY = 'fl64';
		var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH + TYPE_ARRAYBUFFER.length;

		var toString$1 = Object.prototype.toString;

		function stringToBuffer(serializedString) {
		    // Fill the string into a ArrayBuffer.
		    var bufferLength = serializedString.length * 0.75;
		    var len = serializedString.length;
		    var i;
		    var p = 0;
		    var encoded1, encoded2, encoded3, encoded4;

		    if (serializedString[serializedString.length - 1] === '=') {
		        bufferLength--;
		        if (serializedString[serializedString.length - 2] === '=') {
		            bufferLength--;
		        }
		    }

		    var buffer = new ArrayBuffer(bufferLength);
		    var bytes = new Uint8Array(buffer);

		    for (i = 0; i < len; i += 4) {
		        encoded1 = BASE_CHARS.indexOf(serializedString[i]);
		        encoded2 = BASE_CHARS.indexOf(serializedString[i + 1]);
		        encoded3 = BASE_CHARS.indexOf(serializedString[i + 2]);
		        encoded4 = BASE_CHARS.indexOf(serializedString[i + 3]);

		        /*jslint bitwise: true */
		        bytes[p++] = encoded1 << 2 | encoded2 >> 4;
		        bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
		        bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
		    }
		    return buffer;
		}

		// Converts a buffer to a string to store, serialized, in the backend
		// storage library.
		function bufferToString(buffer) {
		    // base64-arraybuffer
		    var bytes = new Uint8Array(buffer);
		    var base64String = '';
		    var i;

		    for (i = 0; i < bytes.length; i += 3) {
		        /*jslint bitwise: true */
		        base64String += BASE_CHARS[bytes[i] >> 2];
		        base64String += BASE_CHARS[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
		        base64String += BASE_CHARS[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
		        base64String += BASE_CHARS[bytes[i + 2] & 63];
		    }

		    if (bytes.length % 3 === 2) {
		        base64String = base64String.substring(0, base64String.length - 1) + '=';
		    } else if (bytes.length % 3 === 1) {
		        base64String = base64String.substring(0, base64String.length - 2) + '==';
		    }

		    return base64String;
		}

		// Serialize a value, afterwards executing a callback (which usually
		// instructs the `setItem()` callback/promise to be executed). This is how
		// we store binary data with localStorage.
		function serialize(value, callback) {
		    var valueType = '';
		    if (value) {
		        valueType = toString$1.call(value);
		    }

		    // Cannot use `value instanceof ArrayBuffer` or such here, as these
		    // checks fail when running the tests using casper.js...
		    //
		    // TODO: See why those tests fail and use a better solution.
		    if (value && (valueType === '[object ArrayBuffer]' || value.buffer && toString$1.call(value.buffer) === '[object ArrayBuffer]')) {
		        // Convert binary arrays to a string and prefix the string with
		        // a special marker.
		        var buffer;
		        var marker = SERIALIZED_MARKER;

		        if (value instanceof ArrayBuffer) {
		            buffer = value;
		            marker += TYPE_ARRAYBUFFER;
		        } else {
		            buffer = value.buffer;

		            if (valueType === '[object Int8Array]') {
		                marker += TYPE_INT8ARRAY;
		            } else if (valueType === '[object Uint8Array]') {
		                marker += TYPE_UINT8ARRAY;
		            } else if (valueType === '[object Uint8ClampedArray]') {
		                marker += TYPE_UINT8CLAMPEDARRAY;
		            } else if (valueType === '[object Int16Array]') {
		                marker += TYPE_INT16ARRAY;
		            } else if (valueType === '[object Uint16Array]') {
		                marker += TYPE_UINT16ARRAY;
		            } else if (valueType === '[object Int32Array]') {
		                marker += TYPE_INT32ARRAY;
		            } else if (valueType === '[object Uint32Array]') {
		                marker += TYPE_UINT32ARRAY;
		            } else if (valueType === '[object Float32Array]') {
		                marker += TYPE_FLOAT32ARRAY;
		            } else if (valueType === '[object Float64Array]') {
		                marker += TYPE_FLOAT64ARRAY;
		            } else {
		                callback(new Error('Failed to get type for BinaryArray'));
		            }
		        }

		        callback(marker + bufferToString(buffer));
		    } else if (valueType === '[object Blob]') {
		        // Conver the blob to a binaryArray and then to a string.
		        var fileReader = new FileReader();

		        fileReader.onload = function () {
		            // Backwards-compatible prefix for the blob type.
		            var str = BLOB_TYPE_PREFIX + value.type + '~' + bufferToString(this.result);

		            callback(SERIALIZED_MARKER + TYPE_BLOB + str);
		        };

		        fileReader.readAsArrayBuffer(value);
		    } else {
		        try {
		            callback(JSON.stringify(value));
		        } catch (e) {
		            console.error("Couldn't convert value into a JSON string: ", value);

		            callback(null, e);
		        }
		    }
		}

		// Deserialize data we've inserted into a value column/field. We place
		// special markers into our strings to mark them as encoded; this isn't
		// as nice as a meta field, but it's the only sane thing we can do whilst
		// keeping localStorage support intact.
		//
		// Oftentimes this will just deserialize JSON content, but if we have a
		// special marker (SERIALIZED_MARKER, defined above), we will extract
		// some kind of arraybuffer/binary data/typed array out of the string.
		function deserialize(value) {
		    // If we haven't marked this string as being specially serialized (i.e.
		    // something other than serialized JSON), we can just return it and be
		    // done with it.
		    if (value.substring(0, SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
		        return JSON.parse(value);
		    }

		    // The following code deals with deserializing some kind of Blob or
		    // TypedArray. First we separate out the type of data we're dealing
		    // with from the data itself.
		    var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
		    var type = value.substring(SERIALIZED_MARKER_LENGTH, TYPE_SERIALIZED_MARKER_LENGTH);

		    var blobType;
		    // Backwards-compatible blob type serialization strategy.
		    // DBs created with older versions of localForage will simply not have the blob type.
		    if (type === TYPE_BLOB && BLOB_TYPE_PREFIX_REGEX.test(serializedString)) {
		        var matcher = serializedString.match(BLOB_TYPE_PREFIX_REGEX);
		        blobType = matcher[1];
		        serializedString = serializedString.substring(matcher[0].length);
		    }
		    var buffer = stringToBuffer(serializedString);

		    // Return the right type based on the code/type set during
		    // serialization.
		    switch (type) {
		        case TYPE_ARRAYBUFFER:
		            return buffer;
		        case TYPE_BLOB:
		            return createBlob([buffer], { type: blobType });
		        case TYPE_INT8ARRAY:
		            return new Int8Array(buffer);
		        case TYPE_UINT8ARRAY:
		            return new Uint8Array(buffer);
		        case TYPE_UINT8CLAMPEDARRAY:
		            return new Uint8ClampedArray(buffer);
		        case TYPE_INT16ARRAY:
		            return new Int16Array(buffer);
		        case TYPE_UINT16ARRAY:
		            return new Uint16Array(buffer);
		        case TYPE_INT32ARRAY:
		            return new Int32Array(buffer);
		        case TYPE_UINT32ARRAY:
		            return new Uint32Array(buffer);
		        case TYPE_FLOAT32ARRAY:
		            return new Float32Array(buffer);
		        case TYPE_FLOAT64ARRAY:
		            return new Float64Array(buffer);
		        default:
		            throw new Error('Unkown type: ' + type);
		    }
		}

		var localforageSerializer = {
		    serialize: serialize,
		    deserialize: deserialize,
		    stringToBuffer: stringToBuffer,
		    bufferToString: bufferToString
		};

		/*
		 * Includes code from:
		 *
		 * base64-arraybuffer
		 * https://github.com/niklasvh/base64-arraybuffer
		 *
		 * Copyright (c) 2012 Niklas von Hertzen
		 * Licensed under the MIT license.
		 */

		function createDbTable(t, dbInfo, callback, errorCallback) {
		    t.executeSql('CREATE TABLE IF NOT EXISTS ' + dbInfo.storeName + ' ' + '(id INTEGER PRIMARY KEY, key unique, value)', [], callback, errorCallback);
		}

		// Open the WebSQL database (automatically creates one if one didn't
		// previously exist), using any options set in the config.
		function _initStorage$1(options) {
		    var self = this;
		    var dbInfo = {
		        db: null
		    };

		    if (options) {
		        for (var i in options) {
		            dbInfo[i] = typeof options[i] !== 'string' ? options[i].toString() : options[i];
		        }
		    }

		    var dbInfoPromise = new Promise$1(function (resolve, reject) {
		        // Open the database; the openDatabase API will automatically
		        // create it for us if it doesn't exist.
		        try {
		            dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version), dbInfo.description, dbInfo.size);
		        } catch (e) {
		            return reject(e);
		        }

		        // Create our key/value table if it doesn't exist.
		        dbInfo.db.transaction(function (t) {
		            createDbTable(t, dbInfo, function () {
		                self._dbInfo = dbInfo;
		                resolve();
		            }, function (t, error) {
		                reject(error);
		            });
		        }, reject);
		    });

		    dbInfo.serializer = localforageSerializer;
		    return dbInfoPromise;
		}

		function tryExecuteSql(t, dbInfo, sqlStatement, args, callback, errorCallback) {
		    t.executeSql(sqlStatement, args, callback, function (t, error) {
		        if (error.code === error.SYNTAX_ERR) {
		            t.executeSql('SELECT name FROM sqlite_master ' + "WHERE type='table' AND name = ?", [dbInfo.storeName], function (t, results) {
		                if (!results.rows.length) {
		                    // if the table is missing (was deleted)
		                    // re-create it table and retry
		                    createDbTable(t, dbInfo, function () {
		                        t.executeSql(sqlStatement, args, callback, errorCallback);
		                    }, errorCallback);
		                } else {
		                    errorCallback(t, error);
		                }
		            }, errorCallback);
		        } else {
		            errorCallback(t, error);
		        }
		    }, errorCallback);
		}

		function getItem$1(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'SELECT * FROM ' + dbInfo.storeName + ' WHERE key = ? LIMIT 1', [key], function (t, results) {
		                    var result = results.rows.length ? results.rows.item(0).value : null;

		                    // Check to see if this is serialized content we need to
		                    // unpack.
		                    if (result) {
		                        result = dbInfo.serializer.deserialize(result);
		                    }

		                    resolve(result);
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function iterate$1(iterator, callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;

		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'SELECT * FROM ' + dbInfo.storeName, [], function (t, results) {
		                    var rows = results.rows;
		                    var length = rows.length;

		                    for (var i = 0; i < length; i++) {
		                        var item = rows.item(i);
		                        var result = item.value;

		                        // Check to see if this is serialized content
		                        // we need to unpack.
		                        if (result) {
		                            result = dbInfo.serializer.deserialize(result);
		                        }

		                        result = iterator(result, item.key, i + 1);

		                        // void(0) prevents problems with redefinition
		                        // of `undefined`.
		                        if (result !== void 0) {
		                            resolve(result);
		                            return;
		                        }
		                    }

		                    resolve();
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function _setItem(key, value, callback, retriesLeft) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            // The localStorage API doesn't return undefined values in an
		            // "expected" way, so undefined is always cast to null in all
		            // drivers. See: https://github.com/mozilla/localForage/pull/42
		            if (value === undefined) {
		                value = null;
		            }

		            // Save the original value to pass to the callback.
		            var originalValue = value;

		            var dbInfo = self._dbInfo;
		            dbInfo.serializer.serialize(value, function (value, error) {
		                if (error) {
		                    reject(error);
		                } else {
		                    dbInfo.db.transaction(function (t) {
		                        tryExecuteSql(t, dbInfo, 'INSERT OR REPLACE INTO ' + dbInfo.storeName + ' ' + '(key, value) VALUES (?, ?)', [key, value], function () {
		                            resolve(originalValue);
		                        }, function (t, error) {
		                            reject(error);
		                        });
		                    }, function (sqlError) {
		                        // The transaction failed; check
		                        // to see if it's a quota error.
		                        if (sqlError.code === sqlError.QUOTA_ERR) {
		                            // We reject the callback outright for now, but
		                            // it's worth trying to re-run the transaction.
		                            // Even if the user accepts the prompt to use
		                            // more storage on Safari, this error will
		                            // be called.
		                            //
		                            // Try to re-run the transaction.
		                            if (retriesLeft > 0) {
		                                resolve(_setItem.apply(self, [key, originalValue, callback, retriesLeft - 1]));
		                                return;
		                            }
		                            reject(sqlError);
		                        }
		                    });
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function setItem$1(key, value, callback) {
		    return _setItem.apply(this, [key, value, callback, 1]);
		}

		function removeItem$1(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'DELETE FROM ' + dbInfo.storeName + ' WHERE key = ?', [key], function () {
		                    resolve();
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Deletes every item in the table.
		// TODO: Find out if this resets the AUTO_INCREMENT number.
		function clear$1(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'DELETE FROM ' + dbInfo.storeName, [], function () {
		                    resolve();
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Does a simple `COUNT(key)` to get the number of items stored in
		// localForage.
		function length$1(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                // Ahhh, SQL makes this one soooooo easy.
		                tryExecuteSql(t, dbInfo, 'SELECT COUNT(key) as c FROM ' + dbInfo.storeName, [], function (t, results) {
		                    var result = results.rows.item(0).c;
		                    resolve(result);
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Return the key located at key index X; essentially gets the key from a
		// `WHERE id = ?`. This is the most efficient way I can think to implement
		// this rarely-used (in my experience) part of the API, but it can seem
		// inconsistent, because we do `INSERT OR REPLACE INTO` on `setItem()`, so
		// the ID of each key will change every time it's updated. Perhaps a stored
		// procedure for the `setItem()` SQL would solve this problem?
		// TODO: Don't change ID on `setItem()`.
		function key$1(n, callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'SELECT key FROM ' + dbInfo.storeName + ' WHERE id = ? LIMIT 1', [n + 1], function (t, results) {
		                    var result = results.rows.length ? results.rows.item(0).key : null;
		                    resolve(result);
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function keys$1(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'SELECT key FROM ' + dbInfo.storeName, [], function (t, results) {
		                    var keys = [];

		                    for (var i = 0; i < results.rows.length; i++) {
		                        keys.push(results.rows.item(i).key);
		                    }

		                    resolve(keys);
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// https://www.w3.org/TR/webdatabase/#databases
		// > There is no way to enumerate or delete the databases available for an origin from this API.
		function getAllStoreNames(db) {
		    return new Promise$1(function (resolve, reject) {
		        db.transaction(function (t) {
		            t.executeSql('SELECT name FROM sqlite_master ' + "WHERE type='table' AND name <> '__WebKitDatabaseInfoTable__'", [], function (t, results) {
		                var storeNames = [];

		                for (var i = 0; i < results.rows.length; i++) {
		                    storeNames.push(results.rows.item(i).name);
		                }

		                resolve({
		                    db: db,
		                    storeNames: storeNames
		                });
		            }, function (t, error) {
		                reject(error);
		            });
		        }, function (sqlError) {
		            reject(sqlError);
		        });
		    });
		}

		function dropInstance$1(options, callback) {
		    callback = getCallback.apply(this, arguments);

		    var currentConfig = this.config();
		    options = typeof options !== 'function' && options || {};
		    if (!options.name) {
		        options.name = options.name || currentConfig.name;
		        options.storeName = options.storeName || currentConfig.storeName;
		    }

		    var self = this;
		    var promise;
		    if (!options.name) {
		        promise = Promise$1.reject('Invalid arguments');
		    } else {
		        promise = new Promise$1(function (resolve) {
		            var db;
		            if (options.name === currentConfig.name) {
		                // use the db reference of the current instance
		                db = self._dbInfo.db;
		            } else {
		                db = openDatabase(options.name, '', '', 0);
		            }

		            if (!options.storeName) {
		                // drop all database tables
		                resolve(getAllStoreNames(db));
		            } else {
		                resolve({
		                    db: db,
		                    storeNames: [options.storeName]
		                });
		            }
		        }).then(function (operationInfo) {
		            return new Promise$1(function (resolve, reject) {
		                operationInfo.db.transaction(function (t) {
		                    function dropTable(storeName) {
		                        return new Promise$1(function (resolve, reject) {
		                            t.executeSql('DROP TABLE IF EXISTS ' + storeName, [], function () {
		                                resolve();
		                            }, function (t, error) {
		                                reject(error);
		                            });
		                        });
		                    }

		                    var operations = [];
		                    for (var i = 0, len = operationInfo.storeNames.length; i < len; i++) {
		                        operations.push(dropTable(operationInfo.storeNames[i]));
		                    }

		                    Promise$1.all(operations).then(function () {
		                        resolve();
		                    })["catch"](function (e) {
		                        reject(e);
		                    });
		                }, function (sqlError) {
		                    reject(sqlError);
		                });
		            });
		        });
		    }

		    executeCallback(promise, callback);
		    return promise;
		}

		var webSQLStorage = {
		    _driver: 'webSQLStorage',
		    _initStorage: _initStorage$1,
		    _support: isWebSQLValid(),
		    iterate: iterate$1,
		    getItem: getItem$1,
		    setItem: setItem$1,
		    removeItem: removeItem$1,
		    clear: clear$1,
		    length: length$1,
		    key: key$1,
		    keys: keys$1,
		    dropInstance: dropInstance$1
		};

		function isLocalStorageValid() {
		    try {
		        return typeof localStorage !== 'undefined' && 'setItem' in localStorage &&
		        // in IE8 typeof localStorage.setItem === 'object'
		        !!localStorage.setItem;
		    } catch (e) {
		        return false;
		    }
		}

		function _getKeyPrefix(options, defaultConfig) {
		    var keyPrefix = options.name + '/';

		    if (options.storeName !== defaultConfig.storeName) {
		        keyPrefix += options.storeName + '/';
		    }
		    return keyPrefix;
		}

		// Check if localStorage throws when saving an item
		function checkIfLocalStorageThrows() {
		    var localStorageTestKey = '_localforage_support_test';

		    try {
		        localStorage.setItem(localStorageTestKey, true);
		        localStorage.removeItem(localStorageTestKey);

		        return false;
		    } catch (e) {
		        return true;
		    }
		}

		// Check if localStorage is usable and allows to save an item
		// This method checks if localStorage is usable in Safari Private Browsing
		// mode, or in any other case where the available quota for localStorage
		// is 0 and there wasn't any saved items yet.
		function _isLocalStorageUsable() {
		    return !checkIfLocalStorageThrows() || localStorage.length > 0;
		}

		// Config the localStorage backend, using options set in the config.
		function _initStorage$2(options) {
		    var self = this;
		    var dbInfo = {};
		    if (options) {
		        for (var i in options) {
		            dbInfo[i] = options[i];
		        }
		    }

		    dbInfo.keyPrefix = _getKeyPrefix(options, self._defaultConfig);

		    if (!_isLocalStorageUsable()) {
		        return Promise$1.reject();
		    }

		    self._dbInfo = dbInfo;
		    dbInfo.serializer = localforageSerializer;

		    return Promise$1.resolve();
		}

		// Remove all keys from the datastore, effectively destroying all data in
		// the app's key/value store!
		function clear$2(callback) {
		    var self = this;
		    var promise = self.ready().then(function () {
		        var keyPrefix = self._dbInfo.keyPrefix;

		        for (var i = localStorage.length - 1; i >= 0; i--) {
		            var key = localStorage.key(i);

		            if (key.indexOf(keyPrefix) === 0) {
		                localStorage.removeItem(key);
		            }
		        }
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Retrieve an item from the store. Unlike the original async_storage
		// library in Gaia, we don't modify return values at all. If a key's value
		// is `undefined`, we pass that value to the callback function.
		function getItem$2(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        var result = localStorage.getItem(dbInfo.keyPrefix + key);

		        // If a result was found, parse it from the serialized
		        // string into a JS object. If result isn't truthy, the key
		        // is likely undefined and we'll pass it straight to the
		        // callback.
		        if (result) {
		            result = dbInfo.serializer.deserialize(result);
		        }

		        return result;
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Iterate over all items in the store.
		function iterate$2(iterator, callback) {
		    var self = this;

		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        var keyPrefix = dbInfo.keyPrefix;
		        var keyPrefixLength = keyPrefix.length;
		        var length = localStorage.length;

		        // We use a dedicated iterator instead of the `i` variable below
		        // so other keys we fetch in localStorage aren't counted in
		        // the `iterationNumber` argument passed to the `iterate()`
		        // callback.
		        //
		        // See: github.com/mozilla/localForage/pull/435#discussion_r38061530
		        var iterationNumber = 1;

		        for (var i = 0; i < length; i++) {
		            var key = localStorage.key(i);
		            if (key.indexOf(keyPrefix) !== 0) {
		                continue;
		            }
		            var value = localStorage.getItem(key);

		            // If a result was found, parse it from the serialized
		            // string into a JS object. If result isn't truthy, the
		            // key is likely undefined and we'll pass it straight
		            // to the iterator.
		            if (value) {
		                value = dbInfo.serializer.deserialize(value);
		            }

		            value = iterator(value, key.substring(keyPrefixLength), iterationNumber++);

		            if (value !== void 0) {
		                return value;
		            }
		        }
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Same as localStorage's key() method, except takes a callback.
		function key$2(n, callback) {
		    var self = this;
		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        var result;
		        try {
		            result = localStorage.key(n);
		        } catch (error) {
		            result = null;
		        }

		        // Remove the prefix from the key, if a key is found.
		        if (result) {
		            result = result.substring(dbInfo.keyPrefix.length);
		        }

		        return result;
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function keys$2(callback) {
		    var self = this;
		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        var length = localStorage.length;
		        var keys = [];

		        for (var i = 0; i < length; i++) {
		            var itemKey = localStorage.key(i);
		            if (itemKey.indexOf(dbInfo.keyPrefix) === 0) {
		                keys.push(itemKey.substring(dbInfo.keyPrefix.length));
		            }
		        }

		        return keys;
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Supply the number of keys in the datastore to the callback function.
		function length$2(callback) {
		    var self = this;
		    var promise = self.keys().then(function (keys) {
		        return keys.length;
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Remove an item from the store, nice and simple.
		function removeItem$2(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        localStorage.removeItem(dbInfo.keyPrefix + key);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Set a key's value and run an optional callback once the value is set.
		// Unlike Gaia's implementation, the callback function is passed the value,
		// in case you want to operate on that value only after you're sure it
		// saved, or something like that.
		function setItem$2(key, value, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = self.ready().then(function () {
		        // Convert undefined values to null.
		        // https://github.com/mozilla/localForage/pull/42
		        if (value === undefined) {
		            value = null;
		        }

		        // Save the original value to pass to the callback.
		        var originalValue = value;

		        return new Promise$1(function (resolve, reject) {
		            var dbInfo = self._dbInfo;
		            dbInfo.serializer.serialize(value, function (value, error) {
		                if (error) {
		                    reject(error);
		                } else {
		                    try {
		                        localStorage.setItem(dbInfo.keyPrefix + key, value);
		                        resolve(originalValue);
		                    } catch (e) {
		                        // localStorage capacity exceeded.
		                        // TODO: Make this a specific error/event.
		                        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
		                            reject(e);
		                        }
		                        reject(e);
		                    }
		                }
		            });
		        });
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function dropInstance$2(options, callback) {
		    callback = getCallback.apply(this, arguments);

		    options = typeof options !== 'function' && options || {};
		    if (!options.name) {
		        var currentConfig = this.config();
		        options.name = options.name || currentConfig.name;
		        options.storeName = options.storeName || currentConfig.storeName;
		    }

		    var self = this;
		    var promise;
		    if (!options.name) {
		        promise = Promise$1.reject('Invalid arguments');
		    } else {
		        promise = new Promise$1(function (resolve) {
		            if (!options.storeName) {
		                resolve(options.name + '/');
		            } else {
		                resolve(_getKeyPrefix(options, self._defaultConfig));
		            }
		        }).then(function (keyPrefix) {
		            for (var i = localStorage.length - 1; i >= 0; i--) {
		                var key = localStorage.key(i);

		                if (key.indexOf(keyPrefix) === 0) {
		                    localStorage.removeItem(key);
		                }
		            }
		        });
		    }

		    executeCallback(promise, callback);
		    return promise;
		}

		var localStorageWrapper = {
		    _driver: 'localStorageWrapper',
		    _initStorage: _initStorage$2,
		    _support: isLocalStorageValid(),
		    iterate: iterate$2,
		    getItem: getItem$2,
		    setItem: setItem$2,
		    removeItem: removeItem$2,
		    clear: clear$2,
		    length: length$2,
		    key: key$2,
		    keys: keys$2,
		    dropInstance: dropInstance$2
		};

		var sameValue = function sameValue(x, y) {
		    return x === y || typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y);
		};

		var includes = function includes(array, searchElement) {
		    var len = array.length;
		    var i = 0;
		    while (i < len) {
		        if (sameValue(array[i], searchElement)) {
		            return true;
		        }
		        i++;
		    }

		    return false;
		};

		var isArray = Array.isArray || function (arg) {
		    return Object.prototype.toString.call(arg) === '[object Array]';
		};

		// Drivers are stored here when `defineDriver()` is called.
		// They are shared across all instances of localForage.
		var DefinedDrivers = {};

		var DriverSupport = {};

		var DefaultDrivers = {
		    INDEXEDDB: asyncStorage,
		    WEBSQL: webSQLStorage,
		    LOCALSTORAGE: localStorageWrapper
		};

		var DefaultDriverOrder = [DefaultDrivers.INDEXEDDB._driver, DefaultDrivers.WEBSQL._driver, DefaultDrivers.LOCALSTORAGE._driver];

		var OptionalDriverMethods = ['dropInstance'];

		var LibraryMethods = ['clear', 'getItem', 'iterate', 'key', 'keys', 'length', 'removeItem', 'setItem'].concat(OptionalDriverMethods);

		var DefaultConfig = {
		    description: '',
		    driver: DefaultDriverOrder.slice(),
		    name: 'localforage',
		    // Default DB size is _JUST UNDER_ 5MB, as it's the highest size
		    // we can use without a prompt.
		    size: 4980736,
		    storeName: 'keyvaluepairs',
		    version: 1.0
		};

		function callWhenReady(localForageInstance, libraryMethod) {
		    localForageInstance[libraryMethod] = function () {
		        var _args = arguments;
		        return localForageInstance.ready().then(function () {
		            return localForageInstance[libraryMethod].apply(localForageInstance, _args);
		        });
		    };
		}

		function extend() {
		    for (var i = 1; i < arguments.length; i++) {
		        var arg = arguments[i];

		        if (arg) {
		            for (var _key in arg) {
		                if (arg.hasOwnProperty(_key)) {
		                    if (isArray(arg[_key])) {
		                        arguments[0][_key] = arg[_key].slice();
		                    } else {
		                        arguments[0][_key] = arg[_key];
		                    }
		                }
		            }
		        }
		    }

		    return arguments[0];
		}

		var LocalForage = function () {
		    function LocalForage(options) {
		        _classCallCheck(this, LocalForage);

		        for (var driverTypeKey in DefaultDrivers) {
		            if (DefaultDrivers.hasOwnProperty(driverTypeKey)) {
		                var driver = DefaultDrivers[driverTypeKey];
		                var driverName = driver._driver;
		                this[driverTypeKey] = driverName;

		                if (!DefinedDrivers[driverName]) {
		                    // we don't need to wait for the promise,
		                    // since the default drivers can be defined
		                    // in a blocking manner
		                    this.defineDriver(driver);
		                }
		            }
		        }

		        this._defaultConfig = extend({}, DefaultConfig);
		        this._config = extend({}, this._defaultConfig, options);
		        this._driverSet = null;
		        this._initDriver = null;
		        this._ready = false;
		        this._dbInfo = null;

		        this._wrapLibraryMethodsWithReady();
		        this.setDriver(this._config.driver)["catch"](function () {});
		    }

		    // Set any config values for localForage; can be called anytime before
		    // the first API call (e.g. `getItem`, `setItem`).
		    // We loop through options so we don't overwrite existing config
		    // values.


		    LocalForage.prototype.config = function config(options) {
		        // If the options argument is an object, we use it to set values.
		        // Otherwise, we return either a specified config value or all
		        // config values.
		        if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
		            // If localforage is ready and fully initialized, we can't set
		            // any new configuration values. Instead, we return an error.
		            if (this._ready) {
		                return new Error("Can't call config() after localforage " + 'has been used.');
		            }

		            for (var i in options) {
		                if (i === 'storeName') {
		                    options[i] = options[i].replace(/\W/g, '_');
		                }

		                if (i === 'version' && typeof options[i] !== 'number') {
		                    return new Error('Database version must be a number.');
		                }

		                this._config[i] = options[i];
		            }

		            // after all config options are set and
		            // the driver option is used, try setting it
		            if ('driver' in options && options.driver) {
		                return this.setDriver(this._config.driver);
		            }

		            return true;
		        } else if (typeof options === 'string') {
		            return this._config[options];
		        } else {
		            return this._config;
		        }
		    };

		    // Used to define a custom driver, shared across all instances of
		    // localForage.


		    LocalForage.prototype.defineDriver = function defineDriver(driverObject, callback, errorCallback) {
		        var promise = new Promise$1(function (resolve, reject) {
		            try {
		                var driverName = driverObject._driver;
		                var complianceError = new Error('Custom driver not compliant; see ' + 'https://mozilla.github.io/localForage/#definedriver');

		                // A driver name should be defined and not overlap with the
		                // library-defined, default drivers.
		                if (!driverObject._driver) {
		                    reject(complianceError);
		                    return;
		                }

		                var driverMethods = LibraryMethods.concat('_initStorage');
		                for (var i = 0, len = driverMethods.length; i < len; i++) {
		                    var driverMethodName = driverMethods[i];

		                    // when the property is there,
		                    // it should be a method even when optional
		                    var isRequired = !includes(OptionalDriverMethods, driverMethodName);
		                    if ((isRequired || driverObject[driverMethodName]) && typeof driverObject[driverMethodName] !== 'function') {
		                        reject(complianceError);
		                        return;
		                    }
		                }

		                var configureMissingMethods = function configureMissingMethods() {
		                    var methodNotImplementedFactory = function methodNotImplementedFactory(methodName) {
		                        return function () {
		                            var error = new Error('Method ' + methodName + ' is not implemented by the current driver');
		                            var promise = Promise$1.reject(error);
		                            executeCallback(promise, arguments[arguments.length - 1]);
		                            return promise;
		                        };
		                    };

		                    for (var _i = 0, _len = OptionalDriverMethods.length; _i < _len; _i++) {
		                        var optionalDriverMethod = OptionalDriverMethods[_i];
		                        if (!driverObject[optionalDriverMethod]) {
		                            driverObject[optionalDriverMethod] = methodNotImplementedFactory(optionalDriverMethod);
		                        }
		                    }
		                };

		                configureMissingMethods();

		                var setDriverSupport = function setDriverSupport(support) {
		                    if (DefinedDrivers[driverName]) {
		                        console.info('Redefining LocalForage driver: ' + driverName);
		                    }
		                    DefinedDrivers[driverName] = driverObject;
		                    DriverSupport[driverName] = support;
		                    // don't use a then, so that we can define
		                    // drivers that have simple _support methods
		                    // in a blocking manner
		                    resolve();
		                };

		                if ('_support' in driverObject) {
		                    if (driverObject._support && typeof driverObject._support === 'function') {
		                        driverObject._support().then(setDriverSupport, reject);
		                    } else {
		                        setDriverSupport(!!driverObject._support);
		                    }
		                } else {
		                    setDriverSupport(true);
		                }
		            } catch (e) {
		                reject(e);
		            }
		        });

		        executeTwoCallbacks(promise, callback, errorCallback);
		        return promise;
		    };

		    LocalForage.prototype.driver = function driver() {
		        return this._driver || null;
		    };

		    LocalForage.prototype.getDriver = function getDriver(driverName, callback, errorCallback) {
		        var getDriverPromise = DefinedDrivers[driverName] ? Promise$1.resolve(DefinedDrivers[driverName]) : Promise$1.reject(new Error('Driver not found.'));

		        executeTwoCallbacks(getDriverPromise, callback, errorCallback);
		        return getDriverPromise;
		    };

		    LocalForage.prototype.getSerializer = function getSerializer(callback) {
		        var serializerPromise = Promise$1.resolve(localforageSerializer);
		        executeTwoCallbacks(serializerPromise, callback);
		        return serializerPromise;
		    };

		    LocalForage.prototype.ready = function ready(callback) {
		        var self = this;

		        var promise = self._driverSet.then(function () {
		            if (self._ready === null) {
		                self._ready = self._initDriver();
		            }

		            return self._ready;
		        });

		        executeTwoCallbacks(promise, callback, callback);
		        return promise;
		    };

		    LocalForage.prototype.setDriver = function setDriver(drivers, callback, errorCallback) {
		        var self = this;

		        if (!isArray(drivers)) {
		            drivers = [drivers];
		        }

		        var supportedDrivers = this._getSupportedDrivers(drivers);

		        function setDriverToConfig() {
		            self._config.driver = self.driver();
		        }

		        function extendSelfWithDriver(driver) {
		            self._extend(driver);
		            setDriverToConfig();

		            self._ready = self._initStorage(self._config);
		            return self._ready;
		        }

		        function initDriver(supportedDrivers) {
		            return function () {
		                var currentDriverIndex = 0;

		                function driverPromiseLoop() {
		                    while (currentDriverIndex < supportedDrivers.length) {
		                        var driverName = supportedDrivers[currentDriverIndex];
		                        currentDriverIndex++;

		                        self._dbInfo = null;
		                        self._ready = null;

		                        return self.getDriver(driverName).then(extendSelfWithDriver)["catch"](driverPromiseLoop);
		                    }

		                    setDriverToConfig();
		                    var error = new Error('No available storage method found.');
		                    self._driverSet = Promise$1.reject(error);
		                    return self._driverSet;
		                }

		                return driverPromiseLoop();
		            };
		        }

		        // There might be a driver initialization in progress
		        // so wait for it to finish in order to avoid a possible
		        // race condition to set _dbInfo
		        var oldDriverSetDone = this._driverSet !== null ? this._driverSet["catch"](function () {
		            return Promise$1.resolve();
		        }) : Promise$1.resolve();

		        this._driverSet = oldDriverSetDone.then(function () {
		            var driverName = supportedDrivers[0];
		            self._dbInfo = null;
		            self._ready = null;

		            return self.getDriver(driverName).then(function (driver) {
		                self._driver = driver._driver;
		                setDriverToConfig();
		                self._wrapLibraryMethodsWithReady();
		                self._initDriver = initDriver(supportedDrivers);
		            });
		        })["catch"](function () {
		            setDriverToConfig();
		            var error = new Error('No available storage method found.');
		            self._driverSet = Promise$1.reject(error);
		            return self._driverSet;
		        });

		        executeTwoCallbacks(this._driverSet, callback, errorCallback);
		        return this._driverSet;
		    };

		    LocalForage.prototype.supports = function supports(driverName) {
		        return !!DriverSupport[driverName];
		    };

		    LocalForage.prototype._extend = function _extend(libraryMethodsAndProperties) {
		        extend(this, libraryMethodsAndProperties);
		    };

		    LocalForage.prototype._getSupportedDrivers = function _getSupportedDrivers(drivers) {
		        var supportedDrivers = [];
		        for (var i = 0, len = drivers.length; i < len; i++) {
		            var driverName = drivers[i];
		            if (this.supports(driverName)) {
		                supportedDrivers.push(driverName);
		            }
		        }
		        return supportedDrivers;
		    };

		    LocalForage.prototype._wrapLibraryMethodsWithReady = function _wrapLibraryMethodsWithReady() {
		        // Add a stub for each driver API method that delays the call to the
		        // corresponding driver method until localForage is ready. These stubs
		        // will be replaced by the driver methods as soon as the driver is
		        // loaded, so there is no performance impact.
		        for (var i = 0, len = LibraryMethods.length; i < len; i++) {
		            callWhenReady(this, LibraryMethods[i]);
		        }
		    };

		    LocalForage.prototype.createInstance = function createInstance(options) {
		        return new LocalForage(options);
		    };

		    return LocalForage;
		}();

		// The actual localForage object that we expose as a module or via a
		// global. It's extended by pulling in one of our other libraries.


		var localforage_js = new LocalForage();

		module.exports = localforage_js;

		},{"3":3}]},{},[4])(4)
		}); 
	} (localforage$1));
	return localforage$1.exports;
}

var localforageExports = requireLocalforage();
var localforage = /*@__PURE__*/getDefaultExportFromCjs(localforageExports);

const PGS_BASE = "https://www.pgscatalog.org/rest";

const ALL_SCORE_SUMMARY_KEY = "PGS_Catalog:all-score-summary"; //fetchAllScores() & fetchSomeScores() uses this key to cache the full list of scores and their summary, which fetchSomeScores() can then use to source individual scores by ID without needing to fetch from network if cache is valid. Also used as source for getScoresPerTrait() / getScoresPerCategory() to link traits or categories to their specific scores and variants info, rather than relying on the more limited topTraits from the all-scores summary.
const TRAIT_SUMMARY_KEY$1 = "PGS_Catalog:trait-summary"; // needed in getScoresPerTrait() and getScoresPerCategory()
const SCORES_PER_TRAIT_SUMMARY_KEY = "PGS_Catalog:scores-per-trait-summary"; // needed in getScoresPerTrait()
const SCORES_PER_CATEGORY_SUMMARY_KEY = "PGS_Catalog:scores-per-category-summary"; // needed in getScoresPerCategory()

function quantile(sorted, q) {
	if (!sorted.length) return null;
	const pos = (sorted.length - 1) * q;
	const base = Math.floor(pos);
	const rest = pos - base;
	if (sorted[base + 1] === undefined) return sorted[base];
	return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

async function saveScoreSummary(results, key = ALL_SCORE_SUMMARY_KEY) {
	if (!localforage) return;
	await localforage.setItem(key, {
		savedAt: new Date().toISOString(),
		summary: results.summary,
		scores: results.scores,
	});
}

async function getStoredScoreSummary(key = ALL_SCORE_SUMMARY_KEY) {
    // console.log("checking local cache for score summary...");
	if (!localforage) return null;
	return localforage.getItem(key);
}

function isCacheWithinMonths$1(savedAt, months = 3) {
	if (!savedAt) return false;
	const savedDate = new Date(savedAt);
	if (Number.isNaN(savedDate.getTime())) return false;

	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - months);
	return savedDate >= cutoff;
}

function getFetchAllScoresErrorMessage(error, context = {}) {
	const { page, offset, pageSize, url, status } = context;
	const locationParts = [];
	if (page != null) locationParts.push(`page ${page}`);
	if (offset != null) locationParts.push(`offset ${offset}`);
	if (pageSize != null) locationParts.push(`page size ${pageSize}`);
	const locationText = locationParts.length ? ` PGS API failed at ${locationParts.join(" / ")}.` : "";
	const urlText = url ? ` Request URL: ${url}` : "";
	const retryText = " Try a smaller page size or use a server-side proxy.";

	if (!error) {
		return `Unable to load all PGS scores from the PGS Catalog.${locationText}${retryText}${urlText}`;
	}

	const message = String(error?.message ?? error);
	if (
		error?.name === "TypeError"
		|| /failed to fetch/i.test(message)
		|| /networkerror/i.test(message)
		|| /load failed/i.test(message)
		|| /cors/i.test(message)
	) {
		return `Unable to load all PGS scores from the PGS Catalog.${locationText} This may be due to a network issue, a CORS restriction, or the PGS API being temporarily unavailable.${retryText}${urlText}`;
	}

	if (status != null) {
		return `Unable to load all PGS scores from the PGS Catalog.${locationText} The PGS API returned HTTP ${status}.${retryText}${urlText}`;
	}

	return `Unable to load all PGS scores from the PGS Catalog.${locationText} ${message}.${retryText}${urlText}`;
}

function computeSummary$1(scores) {//Total scores fetched: 5296,Unique traits: 1,727
	/**
	 * Build aggregate score summary metrics and trait-level mappings.
	 * @param {object[]} scores
	 * @returns {{
	 * totalScores:number,
	 * uniqueTraits:number,
	 * variants:{min:number|null,max:number|null,mean:number|null,median:number|null},
	 * topTraits:Array,
	 * traitToPgsIds:Object,
	 * traitVariantRange:Object,
	 * releaseYears:Array
	 * }}
	 */
	const byTrait = new Map();
	const byTraitPgsIds = new Map();
	const byTraitVariants = new Map();
	const byReleaseYear = new Map();

	const variants = scores
		.map((item) => Number(item.variants_number))
		.filter((v) => Number.isFinite(v))
		.sort((a, b) => a - b);

	for (const score of scores) {
		const trait = score.trait_reported ?? "NR";
		const scoreVariants = Number(score?.variants_number);
		// console.log(`Processing score ID ${score.id}, trait_reported: ${trait}`);
		byTrait.set(trait, (byTrait.get(trait) ?? 0) + 1);
		if (!byTraitPgsIds.has(trait)) {
			byTraitPgsIds.set(trait, new Set());
		}
		if (score?.id) {
			byTraitPgsIds.get(trait).add(score.id);
		}
		if (Number.isFinite(scoreVariants)) {
			if (!byTraitVariants.has(trait)) {
				byTraitVariants.set(trait, {
					min: scoreVariants,
					max: scoreVariants,
				});
			} else {
				const current = byTraitVariants.get(trait);
				current.min = Math.min(current.min, scoreVariants);
				current.max = Math.max(current.max, scoreVariants);
			}
		}

		const yearMatch = (score.date_release ?? "").match(/^(\d{4})/);
		if (yearMatch) {
			const y = yearMatch[1];
			byReleaseYear.set(y, (byReleaseYear.get(y) ?? 0) + 1);
		}
	}

	const topTraits = [...byTrait.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 50);

	const traitToPgsIds = Object.fromEntries(
		[...byTrait.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([trait]) => [trait, [...(byTraitPgsIds.get(trait) ?? new Set())]])
	);

	const releaseYears = [...byReleaseYear.entries()]
		.sort((a, b) => Number(a[0]) - Number(b[0]));

	const traitVariantRange = Object.fromEntries(
		[...byTraitVariants.entries()].map(([trait, range]) => [
			trait,
			{ min: range.min, max: range.max },
		])
	);

	// console.log("topTraits:", [...byTrait.entries()].sort((a, b) => b[1] - a[1]));
	//console.log("traitToPgsIds:", traitToPgsIds);
	
		return {
		totalScores: scores.length,
		uniqueTraits: byTrait.size,
		variants: {
			min: variants[0] ?? null,
			max: variants[variants.length - 1] ?? null,
			mean: variants.length ? variants.reduce((sum, n) => sum + n, 0) / variants.length : null,
			median: quantile(variants, 0.5),
		},
		topTraits,
		traitToPgsIds,
		traitVariantRange,
		releaseYears,
	};
}


function getVariantsRangeFromScores(scores = []) {
	const variants = scores
		.map((score) => Number(score?.variants_number))
		.filter((value) => Number.isFinite(value));

	if (!variants.length) {
		return { min: "NR", max: "NR" };
	}

	return {
		min: Math.min(...variants),
		max: Math.max(...variants),
	};
}

function buildTopTraitsFromScoresPerTrait(scoresPerTraitPayload, maxTraits = 50) {
	/**
	 * Convert scores-per-trait payload into sorted plotting tuples.
	 * @param {object} scoresPerTraitPayload
	 * @param {number} [maxTraits=50]
	 * @returns {Array<[string, number, number|string, number|string]>}
	 */
	const entries = Object.entries(scoresPerTraitPayload?.scoresPerTrait ?? {});
	return entries
		.map(([traitName, traitValue]) => {
			const scoreCount = Array.isArray(traitValue?.scores)
				? traitValue.scores.length
				: (Array.isArray(traitValue?.pgs_ids) ? traitValue.pgs_ids.length : 0);
			const variantsRange = getVariantsRangeFromScores(traitValue?.scores ?? []);
			return [traitName, scoreCount, variantsRange.min, variantsRange.max];
		})
		.sort((a, b) => b[1] - a[1])
		.slice(0, maxTraits);
}

function buildTopCategoriesFromScoresPerCategory(scoresPerCategoryPayload) {
	/**
	 * Convert scores-per-category payload into sorted plotting tuples.
	 * No category limit is applied.
	 * @param {object} scoresPerCategoryPayload
	 * @returns {Array<[string, number, number|string, number|string]>}
	 */
	const entries = Object.entries(scoresPerCategoryPayload?.scoresPerCategory ?? {});
	return entries
		.map(([categoryName, categoryValue]) => {
			const scoreCount = Array.isArray(categoryValue?.scores)
				? categoryValue.scores.length
				: (Array.isArray(categoryValue?.pgs_ids) ? categoryValue.pgs_ids.length : 0);
			const variantsRange = getVariantsRangeFromScores(categoryValue?.scores ?? []);
			return [categoryName, scoreCount, variantsRange.min, variantsRange.max];
		})
		.sort((a, b) => b[1] - a[1]);
}



// ---- core: fetch all scores (paginated) ---- total: 5298 as of 2024-06-20
// Rate-limited - Includes a 200ms delay between requests for safety
  // REST docs indicate paginated responses; default is 50 per page. :contentReference[oaicite:4]{index=4}
async function fetchAllApiScores({ pageSize = 200 } = {}) {
	/**
	 * Fetch all PGS scoring files from the paginated API.
	 * @param {{ pageSize?: number }} [options]
	 * @returns {Promise<object[]>}
	 */
	let offset = 0;
	const all = [];
	let page = 0;

	console.log(`loading all scores from paginated API with page size ${pageSize}...`);

	while (true) {
		page += 1;
		const url = `${PGS_BASE}/score/all?format=json&limit=${pageSize}&offset=${offset}`;
		// console.log(`[fetchAllScores] page ${page} request: ${url}`);
		let response;
		try {
			response = await fetch(url);
		} catch (error) {
			throw new Error(getFetchAllScoresErrorMessage(error, {
				page,
				offset,
				pageSize,
				url,
			}));
		}
		if (!response.ok) {
			throw new Error(getFetchAllScoresErrorMessage(null, {
				page,
				offset,
				pageSize,
				url,
				status: response.status,
			}));
		}
		const data = await response.json();

		const results = Array.isArray(data) ? data : (data.results ?? []);
		if (!Array.isArray(results)) throw new Error("Unexpected response format from PGS API.");

		// console.log(	`[fetchAllApiScores] page ${page} received=${results.length} total_so_far=${all.length + results.length}`
		//);

		all.push(...results);

		if (results.length === 0) {
			// console.log(`[fetchAllApiScores] stop: empty page at page ${page}`);
			break;
		}
		if (!Array.isArray(data) && data.next == null && results.length < pageSize) {
			// console.log(`[fetchAllApiScores] stop: last page reached at page ${page}`);
			break;
		}

		offset += results.length;
		// console.log(`[fetchAllApiScores] next offset=${offset}`);
		await new Promise((r) => setTimeout(r, 100)); // rate safety
	}
	// console.log(`[fetchAllApiScores] done total=${all.length}`);
	return all;
}

// ES6 MODULE: fetchAllScores() is the main function to get scores data and summary,
// using cache if available and valid, and falling back to cache if fetch fails.
// Higher-level app function
// Checks LocalForage cache first (3-month validity)
// If needed, calls fetchAllScores(), computes summary, caches result
// Returns { scores, summary } (not just raw array)
async function fetchAllScores({ cache = true, pageSize = 200 } = {}) {
	/**
	 * Load full score dataset and summary.
	 * Uses all-score LocalForage cache when valid, otherwise fetches and refreshes cache.
	 * @param {{ cache?: boolean, pageSize?: number }} [options]
	 * @returns {Promise<{scores: object[], summary: object|null}>}
	 */
	// console.log("fetchAllScores():Loading scores function...");
	const results = {
		scores: [],
		summary: null,
		errorMessage: null,
		source: null,
		savedAt: null,
	};

	const cached = cache ? await getStoredScoreSummary(ALL_SCORE_SUMMARY_KEY) : null;

	try {
		if (cache && cached?.summary && isCacheWithinMonths$1(cached.savedAt, 3)) {
			results.summary = cached.summary;
			results.scores = cached.scores ?? [];
			results.source = "cache";
			results.savedAt = cached.savedAt ?? null;
	
			return results;
		}

		const scores = await fetchAllApiScores({ pageSize });

		const summary = computeSummary$1(scores);
		results.scores = scores;
		results.summary = summary;
		if (cache) {
			await saveScoreSummary(results, ALL_SCORE_SUMMARY_KEY);
		}
		results.source = "live";
		results.savedAt = new Date().toISOString();

		// console.log("Fetched scores data:", scores);
		return results;
	} catch (error) {
		results.errorMessage = getFetchAllScoresErrorMessage(error);
		if (cache && cached?.summary) {
			results.summary = cached.summary;
			results.scores = cached.scores ?? [];
			results.source = "cache-fallback";
			results.savedAt = cached.savedAt ?? null;
		} else {
			results.source = "unavailable";
		}
		console.error(error);
		return results;
	}
	//console.log("fetchAllScores():Final results:", results);
}


// ---- core: fetch some scores by ID (cache-aware) ----
// What it does:
// Accepts flexible input - Takes a single ID, an array of IDs, or multiple ID arguments
// Optional cache usage - Uses the all-score cache first when { cache: true }
// Fills cache misses - Fetches only missing IDs via fetchSomeAPIScores()
// Returns results - { scores, summary } for the requested IDs only
async function fetchSomeScores(ids, ...args) {
	/**
	 * Load specific scores by ID.
	 * Prefers all-score cache and fetches only missing IDs when needed.
	 * @param {string|string[]} ids
	 * @param {...(string|{cache?: boolean})} args
	 * @returns {Promise<{scores: object[], summary: object|null}>}
	 */
	// console.log("fetchSomeScores():Loading scores function...");
	const results = {
		scores: [],
		summary: null,
	};

	let options = {};
	let moreIds = args;
	const maybeOptions = args.at(-1);
	if (
		maybeOptions
		&& typeof maybeOptions === "object"
		&& !Array.isArray(maybeOptions)
	) {
		options = maybeOptions;
		moreIds = args.slice(0, -1);
	}

	const { cache = true } = options;
	const rawIds = moreIds.length ? [ids, ...moreIds] : ids;
	const inputIds = Array.isArray(rawIds) ? rawIds : [rawIds];
	const requestedIds = [...new Set(
		inputIds
			.map((id) => String(id ?? "").trim())
			.filter(Boolean)
	)];
	const allScoresCached = cache ? await getStoredScoreSummary(ALL_SCORE_SUMMARY_KEY) : null;
	// console.log("fetchSomeScores():all-score cache present:", Boolean(allScoresCached?.scores?.length));

	try {
		if (cache && allScoresCached?.scores && isCacheWithinMonths$1(allScoresCached.savedAt, 3)) {
			const scoreById = new Map(
				allScoresCached.scores
					.filter((score) => score?.id != null)
					.map((score) => [String(score.id), score])
			);
			const scoresFromAllCache = requestedIds
				.map((id) => scoreById.get(id))
				.filter(Boolean);

			if (scoresFromAllCache.length === requestedIds.length) {
				results.scores = scoresFromAllCache;
				results.summary = computeSummary$1(scoresFromAllCache);
				return results;
			}

			const missingIds = requestedIds.filter((id) => !scoreById.has(id));
			console.warn("fetchSomeScores(): missing IDs in all-score cache, fetching:", missingIds);
			const fetchedMissingScores = await fetchSomeAPIScores(missingIds);
			const fetchedById = new Map(
				fetchedMissingScores
					.filter((score) => score?.id != null)
					.map((score) => [String(score.id), score])
			);

			results.scores = requestedIds
				.map((id) => scoreById.get(id) ?? fetchedById.get(id))
				.filter(Boolean);
			results.summary = computeSummary$1(results.scores);
			return results;
		}

		const scores = await fetchSomeAPIScores(requestedIds);
		const summary = computeSummary$1(scores);
		results.scores = scores;
		results.summary = summary;
		// console.log("------------------------------");
		// console.log("Total scores fetched:", scores.length);
		// console.log("Fetched scores data:", scores);
		// console.log("Summary:", summary);

		return results;
	} catch (error) {
		console.error(error);
		return results;
	}
}

// ---- core: fetch some scores by ID from the API ----
// What it does:
// Accepts flexible input - Takes a single ID or an array of IDs
// Normalizes & deduplicates - Converts inputs to strings, trims whitespace, and removes duplicates
// Fetches directly from the API - Calls https://www.pgscatalog.org/rest/score/{id} for each requested ID
// Rate-limited - Includes a 200ms delay between requests for safety
// Returns results - Array of fetched score objects; skips IDs that fail to fetch (with warnings)
async function fetchSomeAPIScores(ids = []) {
	/**
	 * Fetch one or more PGS scoring files by ID.
	 * Accepts a single ID or array; normalizes and de-duplicates IDs.
	 * @param {string|string[]} ids
	 * @returns {Promise<object[]>}
	 */
	const inputIds = Array.isArray(ids) ? ids : [ids];
	const normalizedIds = [...new Set(
		inputIds
			.map((id) => String(id ?? "").trim())
			.filter(Boolean)
	)];
	const results = [];

	for (const id of normalizedIds) {
		const url = `${PGS_BASE}/score/${id}`;

		const response = await fetch(url);

		if (!response.ok) {
			console.warn(`Skipping ${id} (status ${response.status})`);
			continue;
		}

		const data = await response.json();
		results.push(data);
		await new Promise((r) => setTimeout(r, 200)); // rate safety
	}

	return results;
}
//---------------START OF TRAIT-SCORE AND CATEGORY-SCORE LINKING LOGIC------------------

function getAssociatedPgsIdsFromTrait(trait) {
	if (!trait || typeof trait !== "object") return [];

	if (Array.isArray(trait.associated_pgs_ids)) return trait.associated_pgs_ids;
	if (Array.isArray(trait.pgs_ids)) return trait.pgs_ids;
	if (Array.isArray(trait.associated_pgs)) {
		return trait.associated_pgs
			.map((item) => (typeof item === "string" ? item : item?.id ?? item?.pgs_id))
			.filter(Boolean);
	}
	if (Array.isArray(trait.scores)) {
		return trait.scores
			.map((item) => (typeof item === "string" ? item : item?.id ?? item?.pgs_id))
			.filter(Boolean);
	}

	return [];
}

function getTraitName(trait, index) {
	return trait?.label
		?? trait?.trait_label
		?? trait?.name
		?? trait?.trait_reported
		?? trait?.id
		?? `trait-${index + 1}`;
}

function normalizeCategoryEntries(entries) {
	if (!Array.isArray(entries)) return [];

	return entries.map((entry) => {
		if (Array.isArray(entry)) {
			return {
				category: entry[0],
				pgs_ids: Array.isArray(entry[2]) ? entry[2] : [],
			};
		}
		return entry;
	});
}

function getCategoryToPgsIdsFromTraitSummary(traitSummary) {
	const summary = traitSummary?.summary ?? traitSummary;
	const categoryToPgsIds = new Map();
	const categories = normalizeCategoryEntries(summary?.categories ?? summary?.topCategories);

	for (const entry of categories) {
		const categoryName = entry?.category ?? "NR";
		if (!categoryToPgsIds.has(categoryName)) {
			categoryToPgsIds.set(categoryName, new Set());
		}
		const idSet = categoryToPgsIds.get(categoryName);
		for (const pgsId of (entry?.pgs_ids ?? [])) {
			idSet.add(pgsId);
		}
	}

	return [...categoryToPgsIds.entries()]
		.map(([categoryName, idSet]) => [categoryName, [...idSet]])
		.filter(([, ids]) => ids.length > 0);
}

function getTraitToPgsIdsFromTraitSummary(traitSummary) {
	const summary = traitSummary?.summary ?? traitSummary;
	const traitToPgsIds = new Map();

	const traits = Array.isArray(summary?.traits) ? summary.traits : [];
	if (traits.length) {
		traits.forEach((trait, index) => {
			const traitName = getTraitName(trait, index);
			if (!traitToPgsIds.has(traitName)) {
				traitToPgsIds.set(traitName, new Set());
			}
			const idSet = traitToPgsIds.get(traitName);
			for (const pgsId of getAssociatedPgsIdsFromTrait(trait)) {
				idSet.add(pgsId);
			}
		});
	}

	if (!traitToPgsIds.size) {
		const categories = normalizeCategoryEntries(summary?.categories ?? summary?.topCategories);
		for (const entry of categories) {
			const traitName = entry?.category ?? "NR";
			if (!traitToPgsIds.has(traitName)) {
				traitToPgsIds.set(traitName, new Set());
			}
			const idSet = traitToPgsIds.get(traitName);
			for (const pgsId of (entry?.pgs_ids ?? [])) {
				idSet.add(pgsId);
			}
		}
	}

	return [...traitToPgsIds.entries()]
		.map(([traitName, idSet]) => [traitName, [...idSet]])
		.filter(([, ids]) => ids.length > 0);
}


// TRAITS/CATEGORIES are linked indirectly through the cached traitSummary object, using PGS IDs as the bridge.
async function getScoresPerTrait({ forceRefresh = false, maxTraits = Infinity } = {}) {
	/**
	 * Build and cache trait -> scores mapping using trait-summary-linked PGS IDs.
	 * Optimized: loads all scores once and builds a Map lookup instead of calling fetchSomeScores() per trait.
	 * @param {{ forceRefresh?: boolean, maxTraits?: number }} [options]
	 * @returns {Promise<object>}
	 */
	// console.log("getScoresPerTrait():Loading scores per trait...");
	const cached = await getStoredScoreSummary(SCORES_PER_TRAIT_SUMMARY_KEY);
	if (!forceRefresh && cached?.scoresPerTrait) {
		return cached;
	}

	const traitSummary = await getStoredScoreSummary(TRAIT_SUMMARY_KEY$1);
	if (!traitSummary?.summary && !traitSummary?.categories) {
		throw new Error("Missing trait summary cache (TRAIT_SUMMARY_KEY). Call fetchTraits() first, or run fetchDataAndRenderPlots() to fetch and render trait data.");
	}

	// Load all scores once and build a Map for fast lookup
	const { scores: allScores } = await fetchAllScores();
	const scoreById = new Map(
		allScores
			.filter((score) => score?.id != null)
			.map((score) => [String(score.id), score])
	);

	const traitEntries = getTraitToPgsIdsFromTraitSummary(traitSummary);
	const scoresPerTrait = {};
	let processedTraits = 0;

	for (const [traitName, pgsIds] of traitEntries) {
		if (processedTraits >= maxTraits) break;
		// console.log(`Building getScoresPerTrait for trait ${traitName} with ${pgsIds.length} associated PGS IDs...`);
		const traitScores = pgsIds.map((id) => scoreById.get(String(id))).filter(Boolean);
		scoresPerTrait[traitName] = {
			pgs_ids: pgsIds,
			scores: traitScores,
			summary: computeSummary$1(traitScores),
		};
		processedTraits += 1;
	}

	const payload = {
		savedAt: new Date().toISOString(),
		sourceTraitSavedAt: traitSummary?.savedAt ?? null,
		processedTraits,
		totalTraitEntries: traitEntries.length,
		scoresPerTrait,
	};

	await localforage.setItem(SCORES_PER_TRAIT_SUMMARY_KEY, payload);
	return payload;
}

//---------------START OF CATEGORY-SCORE LINKING LOGIC------------------

// TODO error: 1700 traits vs 669. 
async function getScoresPerCategory({ forceRefresh = false, maxCategories = Infinity } = {}) {
	/**
	 * Build and cache category -> scores mapping using trait-summary-linked PGS IDs.
	 * Optimized: loads all scores once and builds a Map lookup instead of calling fetchSomeScores() per category.
	 * @param {{ forceRefresh?: boolean, maxCategories?: number }} [options]
	 * @returns {Promise<object>}
	 */
	// console.log("getScoresPerCategory():Loading scores per category...");
	const cached = await getStoredScoreSummary(SCORES_PER_CATEGORY_SUMMARY_KEY);
	if (!forceRefresh && cached?.scoresPerCategory) {
		return cached;
	}

	const traitSummary = await getStoredScoreSummary(TRAIT_SUMMARY_KEY$1);
	if (!traitSummary?.summary && !traitSummary?.categories) {
		throw new Error("Missing trait summary cache (TRAIT_SUMMARY_KEY). Call fetchTraits() first, or run fetchDataAndRenderPlots() to fetch and render trait data.");
	}

	// Load all scores once and build a Map for fast lookup
	const { scores: allScores } = await fetchAllScores();
	const scoreById = new Map(
		allScores
			.filter((score) => score?.id != null)
			.map((score) => [String(score.id), score])
	);

	const categoryEntries = getCategoryToPgsIdsFromTraitSummary(traitSummary);
	const scoresPerCategory = {};
	let processedCategories = 0;

	for (const [categoryName, pgsIds] of categoryEntries) {
		if (processedCategories >= maxCategories) break;
		// console.log(`Building getScoresPerCategory for category: "${categoryName}" with ${pgsIds.length} associated PGS IDs...`);
		const categoryScores = pgsIds.map((id) => scoreById.get(String(id))).filter(Boolean);
		scoresPerCategory[categoryName] = {
			pgs_ids: pgsIds,
			scores: categoryScores,
			summary: computeSummary$1(categoryScores),
		};
		processedCategories += 1;
	}

	const payload = {
		savedAt: new Date().toISOString(),
		sourceTraitSavedAt: traitSummary?.savedAt ?? null,
		processedCategories,
		totalCategoryEntries: categoryEntries.length,
		scoresPerCategory,
	};

	await localforage.setItem(SCORES_PER_CATEGORY_SUMMARY_KEY, payload);
	return payload;
}
//---------------END OF CATEGORY-SCORE LINKING LOGIC------------------

// Expose for dev console
if (typeof window !== "undefined") {
	window.fetchSomeScores = fetchSomeScores;
	//window.fetchSomeAPIScores = fetchSomeAPIScores;
	window.fetchAllScores = fetchAllScores;
	window.getScoresPerTrait = getScoresPerTrait;
	window.getScoresPerCategory = getScoresPerCategory;
	//window.getScoresPerCategory2 = getScoresPerCategory2;
}

// load all traits (paginated) and log stats about them to console  
const BASE = "https://www.pgscatalog.org/rest";
const TRAIT_SUMMARY_KEY = "PGS_Catalog:trait-summary";

// ---- small helpers ----

async function rawTraitArrayFromAPI({ pageSize = 50, maxPages = Infinity } = {}) {
  let offset = 0;
  let page = 0;
  const all = [];
  while (page < maxPages) {
	// console.log("rawTraitArrayFromAPI(), Fetching traits with pageSize:", pageSize, "maxPages:", maxPages);

    const url = `${BASE}/trait/all?format=json&limit=${pageSize}&offset=${offset}`;
	// console.log("rawTraitArrayFromAPI(), Requesting traits from URL:", url);
    // console.log(`traits****Requesting: ${url}`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    const data = await r.json();

    const results = Array.isArray(data) ? data : (data.results ?? []);
    if (!Array.isArray(results)) throw new Error("Unexpected trait response shape.");

    all.push(...results);
    page += 1;

    if (results.length === 0) break;
    if (!Array.isArray(data) && data.next == null && results.length < pageSize) break;

    offset += results.length;
	}
// console.log(`rawTraitArrayFromAPI(), Completed fetching traits. Total fetched: ${all.length}, all:`, all);
  return all;
}


async function saveTraitSummary(summary) {
	await localforage.setItem(TRAIT_SUMMARY_KEY, 
		//savedAt: new Date().toISOString(),
		summary
	);
}

async function getStoredTraitSummary() {
    // console.log("checking local cache for trait summary...");
	return localforage.getItem(TRAIT_SUMMARY_KEY);
}

function isCacheWithinMonths(savedAt, months = 3) {
	if (!savedAt) return false;
	const savedDate = new Date(savedAt);
	if (Number.isNaN(savedDate.getTime())) return false;

	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - months);

	return savedDate >= cutoff;
}


// ---- main function to load trait stats, with caching ----

function computeSummary(traits) {//used in fetchDataAndRenderPlots()
	//const traits = await rawTraitArrayFromAPI({ pageSize: 200 });
	// console.log(" computeSummary(traits), Computing trait summary for traits:", traits.length);	
	const byCategory = new Map();
	const traitDataByCategory = new Map();
	const pgsIdsByCategory = new Map();

	const getAssociatedPgsIds = (trait) => {
		if (!trait || typeof trait !== "object") return [];

		if (Array.isArray(trait.associated_pgs_ids)) return trait.associated_pgs_ids;
		if (Array.isArray(trait.pgs_ids)) return trait.pgs_ids;

		if (Array.isArray(trait.associated_pgs)) {
			return trait.associated_pgs
				.map((item) => (typeof item === "string" ? item : item?.id ?? item?.pgs_id))
				.filter(Boolean);
		}
		if (Array.isArray(trait.scores)) {
			return trait.scores
				.map((item) => (typeof item === "string" ? item : item?.id ?? item?.pgs_id))
				.filter(Boolean);
		}

		return [];
	};

	for (const trait of traits) {
		// console.log("Processing trait:", trait);
		const categories = Array.isArray(trait?.trait_categories) && trait.trait_categories.length
			? trait.trait_categories
			: ["NR"];
		const associatedPgsIds = getAssociatedPgsIds(trait);
		// console.log(`Trait "${trait?.label ?? trait?.name ?? trait?.id}" categories:`, categories, "associated PGS IDs:", associatedPgsIds);
		for (const category of categories) {
			//console.log(`Incrementing category count for: ${category}`);	
			byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
			if (!traitDataByCategory.has(category)) {
				traitDataByCategory.set(category, []);
			}
			if (!pgsIdsByCategory.has(category)) {
				pgsIdsByCategory.set(category, new Set());
			}
			const categoryPgsSet = pgsIdsByCategory.get(category);
			for (const pgsId of associatedPgsIds) {
				categoryPgsSet.add(pgsId);
			}
			traitDataByCategory.get(category).push({
				id: trait?.id ?? trait?.efo_id ?? null,
				// label: trait?.label ?? trait?.trait_label ?? trait?.name ?? "NR",
				// efo_id: trait?.efo_id ?? null,
				data: trait, // include full traits for potential drill-down use
				// add other relevant fields as needed
			});
			//console.log(`Category "${category}" count is now: ${byCategory.get(category)}`);	
		}
	}

	const categories = [...byCategory.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([categoryName, count]) => ({
			category: categoryName,
			"traits_count": count,
			"pgs_ids": [...(pgsIdsByCategory.get(categoryName) ?? new Set())],
			"pgs_ids_count": pgsIdsByCategory.get(categoryName)?.size ?? 0,
			"traits": traitDataByCategory.get(categoryName) ?? [],
		}));
		//.slice(0, 10);

	// const totalAssociatedPgsIdsPerCategory = Object.fromEntries(
	// 	[...pgsIdsByCategory.entries()].map(([categoryName, pgsIdsSet]) => [
	// 		categoryName,
	// 		pgsIdsSet.size,
	// 	])
	// );

	return {
        traits: traits,
		// totaltraits: traits.length,
		// totalCategories: byCategory.size,
		// totalAssociatedPgsIdsPerCategory,
		categories,
	};
}
async function fetchTraits() {
	// console.log("fetchTraits(), Loading fetchTraits()...");

	const cached = await getStoredTraitSummary();
	// console.log("fetchTraits(), Cached trait data available???", cached);

	try {
		if (cached?.summary && isCacheWithinMonths(cached.savedAt, 3)) {
			return {
				summary: cached.summary,
				source: "cache",
				savedAt: cached.savedAt,
			};
		}

		const traits = await rawTraitArrayFromAPI({ pageSize: 200 });
		// console.log("###############fetchTraits(), Raw traits fetched:", traits.length, traits);
		const summary = await computeSummary(traits);
		// console.log('------------------------------');
		// console.log("Total traits fetched:", traits.length);
		// console.log("Summary:", summary);

		const res = {
			summary: summary,
			source: "live",
			savedAt: new Date().toISOString(),
		};
		await saveTraitSummary(res);
		return res;
	} catch (error) {
		if (cached?.summary) {
			console.error(error);
			return {
				summary: cached.summary,
				source: "cache-fallback",
				savedAt: cached.savedAt,
				error,
			};
		}

		throw error;
	}
}

// Expose for dev console
if (typeof window !== "undefined") {
	//window.rawTraitArrayFromAPI = rawTraitArrayFromAPI;
	window.fetchTraits = fetchTraits;
}

function formatNumber(value, decimals = 0) {
	if (value == null || Number.isNaN(value)) return "NR";
	return Number(value).toLocaleString(undefined, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}

function setTextContent(id, text) {
	const element = document.getElementById(id);
	if (!element) return;
	element.textContent = text;
}

function renderTraitStatus({ sourceStatus, output } = {}) {
	if (sourceStatus !== undefined) {
		setTextContent("traitSourceStatus", sourceStatus);
	}
	if (output !== undefined) {
		setTextContent("traitOutput", output);
	}
}

function renderScoreTraitStatus({ sourceStatus, output } = {}) {
	if (sourceStatus !== undefined) {
		setTextContent("scoreSourceStatusTrait", sourceStatus);
	}
	if (output !== undefined) {
		setTextContent("scoreTraitOutput", output);
	}
}

function renderScoreCategoryStatus({ sourceStatus, output } = {}) {
	if (sourceStatus !== undefined) {
		setTextContent("scoreSourceStatusCategory", sourceStatus);
	}
	if (output !== undefined) {
		setTextContent("scoreCategoryOutput", output);
	}
}

function getTraitCategoryEntries(summary) {
	const entries = Array.isArray(summary?.categories)
		? summary.categories
		: (Array.isArray(summary?.topCategories) ? summary.topCategories : []);

	return entries.map((entry) => {
		if (Array.isArray(entry)) {
			const pgsIds = Array.isArray(entry[2]) ? entry[2] : [];
			return {
				category: entry[0],
				"traits_count": entry[1],
				"pgs_ids": pgsIds,
				"pgs_ids_count": pgsIds.length,
				"traits": entry[3] ?? [],
			};
		}
		if (entry && typeof entry === "object" && Array.isArray(entry["pgs_ids"])) {
			return {
				...entry,
				"pgs_ids_count": entry["pgs_ids"].length,
			};
		}
		return entry;
	});
}

function renderTraitStats(summary) {
	const statsDiv = document.getElementById("traitDiv");
	if (!statsDiv) return;

	const topCategory = getTraitCategoryEntries(summary)[0];
	const topCategoryLabel = topCategory
		? `${topCategory.category} (${formatNumber(topCategory["traits_count"])})`
		: "NR";

	statsDiv.innerHTML = `
		<div class="small text-muted">
			<div><strong>Total traits:</strong> ${formatNumber(summary.traits.length)}</div>
			<div><strong>Total categories:</strong> ${formatNumber(summary.categories.length)}</div>
			<div><strong>Top category:</strong> ${topCategoryLabel}</div>
		</div>
	`;
}

function renderTraitPlot(summary) {
	if (typeof Plotly === "undefined") return;

	const chartDiv = document.getElementById("traitChart");
	if (!chartDiv) return;

	const categoryEntries = getTraitCategoryEntries(summary);
	const categories = categoryEntries.map((entry) => entry.category);
	const counts = categoryEntries.map((entry) => entry["traits_count"]);
	const data = [
		{
			type: "bar",
			x: counts,
			y: categories,
			orientation: "h",
			marker: { color: "#0d6efd" },
		},
	];

	const layout = {
		title: {
			text: "Traits per Category",
			x: 0.5,
			xanchor: "center",
		},
		margin: { l: 260, r: 20, t: 80, b: 90 },
		xaxis: {
			title: {
				text: "Trait count",
				standoff: 10,
			},
			side: "bottom",
			automargin: true,
		},
		yaxis: { automargin: true },
	};

	Plotly.newPlot(chartDiv, data, layout, { responsive: true });
}

function renderScoreStats(summary) {
	const statsDiv = document.getElementById("scoreTraitDiv");
	if (!statsDiv) return;

	statsDiv.innerHTML = `
		<div class="small text-muted">
			<div><strong>Total scores:</strong> ${formatNumber(summary.totalScores)}</div>
			<div><strong>Unique traits:</strong> ${formatNumber(summary.uniqueTraits)}</div>
			<div><strong>Variants (median):</strong> ${formatNumber(summary.variants.median)}</div>
			<div><strong>Variants (mean):</strong> ${formatNumber(summary.variants.mean, 2)}</div>
			<div><strong>Variants range:</strong> ${formatNumber(summary.variants.min)} - ${formatNumber(summary.variants.max)}</div>
		</div>
	`;
}

function renderScorePlot(summary) {
	if (typeof Plotly === "undefined") return;

	const chartDiv = document.getElementById("scoreTraitChart");
	if (!chartDiv) return;

	const topTraits = Array.isArray(summary?.topTraits) ? summary.topTraits : [];
	const traits = topTraits.map((t) => t[0]);
	const counts = topTraits.map((t) => t[1]);
	const customData = topTraits.map((entry) => {
		const min = entry?.[2] ?? "NR";
		const max = entry?.[3] ?? "NR";
		return [min, max];
	});

	const data = [
		{
			type: "bar",
			x: counts,
			y: traits,
			customdata: customData,
			hovertemplate: "Trait: %{y}<br>Score count: %{x}<br>Variants range: %{customdata[0]} - %{customdata[1]}<extra></extra>",
			orientation: "h",
			marker: { color: "#7c1707" },
		},
	];

	const chartHeight = Math.max(200, traits.length * 35 + 100);

	const layout = {
		title: {
			text: "Scoring files per Trait for Top 10 Reported Traits",
			x: 0.5,
			xanchor: "center",
		},
		height: chartHeight,
		margin: { l: 260, r: 20, t: 90, b: 120 },
		xaxis: {
			title: {
				text: "Scoring files count ",
				standoff: 24,
			},
			side: "bottom",
			automargin: true,
		},
		yaxis: { automargin: true },
	};

	Plotly.newPlot(chartDiv, data, layout, { responsive: true });
}

function renderScorePerCategoryStats(topCategories) {
	const statsDiv = document.getElementById("scoreCategoryDiv");
	if (!statsDiv) return;

	const topCategory = topCategories[0] ?? null;
	const topCategoryLabel = topCategory
		? `${topCategory[0]} (${formatNumber(topCategory[1])})`
		: "NR";

	statsDiv.innerHTML = `
		<div class="small text-muted">
			<div><strong>Total categories:</strong> ${formatNumber(topCategories.length)}</div>
			<div><strong>Top category:</strong> ${topCategoryLabel}</div>
		</div>
	`;
}

function renderScorePerCategoryPlot(topCategories) {
	if (typeof Plotly === "undefined") return;

	const chartDiv = document.getElementById("scoreCategoryChart");
	if (!chartDiv) return;

	const categories = topCategories.map((entry) => entry[0]);
	const counts = topCategories.map((entry) => entry[1]);
	const customData = topCategories.map((entry) => {
		const min = entry?.[2] ?? "NR";
		const max = entry?.[3] ?? "NR";
		return [min, max];
	});
	const chartHeight = Math.max(500, categories.length * 28 + 160);

	const data = [
		{
			type: "bar",
			x: counts,
			y: categories,
			customdata: customData,
			hovertemplate: "Category: %{y}<br>Score count: %{x}<br>Variants range: %{customdata[0]} - %{customdata[1]}<extra></extra>",
			orientation: "h",
			marker: { color: "#198754" },
		},
	];

	const layout = {
		title: {
			text: "Scoring Files per Category",
			x: 0.5,
			xanchor: "center",
		},
		height: chartHeight,
		margin: { l: 260, r: 20, t: 90, b: 120 },
		xaxis: {
			title: {
				text: "Scoring files count",
				standoff: 24,
			},
			side: "bottom",
			automargin: true,
		},
		yaxis: { automargin: true },
	};

	Plotly.newPlot(chartDiv, data, layout, { responsive: true });
}

async function fetchDataAndRenderPlots() {
	try {
		renderTraitStatus({ sourceStatus: "Source: loading PGS trait metadata..." });

		const results = await fetchTraits();
		const summary = results?.summary ?? null;
		if (!summary) {
			renderTraitStatus({
				sourceStatus: "Source: unavailable",
				output: "Error loading stats: missing trait summary data.",
			});
			return null;
		}

		renderTraitStats(summary);
		renderTraitPlot(summary);

		if (results.source === "cache") {
			renderTraitStatus({
				sourceStatus: "Source: local cache (LocalForage, < 3 months)",
				output: `Loaded ${formatNumber(summary.traits.length)} cached traits summary (${results.savedAt}).`,
			});
		} else if (results.source === "cache-fallback") {
			renderTraitStatus({
				sourceStatus: "Source: local cache (LocalForage fallback)",
				output: `Loaded ${formatNumber(summary.traits.length)} cached traits summary (${results.savedAt}).`,
			});
			if (results.error) {
				console.error(results.error);
			}
		} else {
			renderTraitStatus({
				sourceStatus: "Source: PGS Catalog REST API (live)",
				output: `Loaded ${formatNumber(summary.traits.length)} traits from PGS Catalog.`,
			});
		}

		return summary;
	} catch (error) {
		renderTraitStatus({
			sourceStatus: "Source: unavailable",
			output: `Error loading stats: ${error.message}`,
		});
		console.error(error);
		return null;
	}
}

async function loadScoreStats({ includeAllScoreStats = false, includeTraitStats = false, includeCategoryStats = false } = {}) {
	let plotTopTraits = null;
	let scoresPerCategoryPayload = null;
	let plotTopCategories = null;
	let results = { scores: [], summary: null };

	try {
		renderScoreTraitStatus({
			sourceStatus: includeAllScoreStats
				? (includeTraitStats
					? "Source: loading PGS score metadata..."
					: "Source: loading PGS score metadata (trait-linked stats not requested)...")
				: (includeTraitStats ? "Source: loading trait-linked score metadata..." : "Source: not requested"),
			output: !includeAllScoreStats && !includeTraitStats ? "Score stats not loaded." : undefined,
		});
		renderScoreCategoryStatus({
			sourceStatus: includeCategoryStats ? "Source: loading linked category score metadata..." : "Source: not requested",
			output: !includeCategoryStats ? "Category-linked score stats not loaded." : undefined,
		});

		if (includeTraitStats || includeCategoryStats) {
			await fetchTraits();
		}
		if (includeAllScoreStats || includeTraitStats || includeCategoryStats) {
			results = await fetchAllScores();
		}

		const summary = results.summary;
		const scoreSource = results.source;
		const scoreSavedAt = results.savedAt;
		const fetchAllScoresErrorMessage = results.errorMessage;

		if (includeTraitStats) {
			try {
				const scoresPerTrait = await getScoresPerTrait();
				plotTopTraits = buildTopTraitsFromScoresPerTrait(scoresPerTrait, 10);
			} catch (error) {
				console.warn("loadScoreStats(): unable to build topTraits from getScoresPerTrait", error);
			}
		}
		if (includeCategoryStats) {
			try {
				scoresPerCategoryPayload = await getScoresPerCategory();
				plotTopCategories = buildTopCategoriesFromScoresPerCategory(scoresPerCategoryPayload);
			} catch (error) {
				console.warn("loadScoreStats(): unable to build categories from getScoresPerCategory", error);
			}
		}

		if (includeAllScoreStats && !summary) {
			renderScoreTraitStatus({
				sourceStatus: "Source: unavailable",
				output: fetchAllScoresErrorMessage ?? "Error loading stats: missing summary data.",
			});
			if (includeCategoryStats) {
				renderScoreCategoryStatus({
					sourceStatus: "Source: unavailable",
					output: fetchAllScoresErrorMessage ?? "Error loading category-linked stats: missing summary data.",
				});
			}
			return results;
		}

		if (includeAllScoreStats && summary && scoreSource === "cache") {
			const summaryForPlot = {
				...summary,
				topTraits: plotTopTraits ?? summary.topTraits,
			};
			renderScoreStats(summary);
			renderScorePlot(summaryForPlot);
			renderScoreTraitStatus({
				sourceStatus: includeTraitStats
					? "Source: local cache (all-score-summary + scores-per-trait-summary, < 3 months)"
					: "Source: local cache (all-score-summary, < 3 months)",
				output: includeTraitStats
					? `Loaded ${formatNumber(summary.totalScores)} cached scores summary + trait-linked score cache (${scoreSavedAt}).`
					: `Loaded ${formatNumber(summary.totalScores)} cached scores summary (${scoreSavedAt}).`,
			});
		} else if (includeAllScoreStats && summary && scoreSource === "cache-fallback") {
			const summaryForPlot = {
				...summary,
				topTraits: plotTopTraits ?? summary.topTraits,
			};
			renderScoreStats(summary);
			renderScorePlot(summaryForPlot);
			renderScoreTraitStatus({
				sourceStatus: includeTraitStats
					? "Source: local cache fallback (all-score-summary + scores-per-trait-summary)"
					: "Source: local cache fallback (all-score-summary)",
				output: includeTraitStats
					? `Loaded ${formatNumber(summary.totalScores)} cached scores summary + trait-linked score cache (${scoreSavedAt}).`
					: `Loaded ${formatNumber(summary.totalScores)} cached scores summary (${scoreSavedAt}).`,
			});
		} else if (includeAllScoreStats && summary) {
			const summaryForPlot = {
				...summary,
				topTraits: plotTopTraits ?? summary.topTraits,
			};
			renderScoreStats(summary);
			renderScorePlot(summaryForPlot);
			renderScoreTraitStatus({
				sourceStatus: includeTraitStats
					? "Source: PGS Catalog REST API (live; refreshed all-score-summary + scores-per-trait-summary)"
					: "Source: PGS Catalog REST API (live; refreshed all-score-summary)",
				output: includeTraitStats
					? `Loaded ${formatNumber(summary.totalScores)} scores from PGS Catalog and built trait-linked score cache.`
					: `Loaded ${formatNumber(summary.totalScores)} scores from PGS Catalog.`,
			});
		} else if (includeTraitStats && plotTopTraits?.length) {
			renderScorePlot({ topTraits: plotTopTraits });
			renderScoreTraitStatus({
				sourceStatus: "Source: trait-linked score cache",
				output: `Loaded ${formatNumber(plotTopTraits.length)} trait-linked scoring summaries.`,
			});
		} else if (includeTraitStats) {
			renderScoreTraitStatus({
				sourceStatus: "Source: unavailable",
				output: "Error loading trait-linked stats: no trait data.",
			});
		}

		if (includeCategoryStats && plotTopCategories?.length) {
			renderScorePerCategoryStats(plotTopCategories);
			renderScorePerCategoryPlot(plotTopCategories);
			const categorySavedAt = scoresPerCategoryPayload?.savedAt;
			renderScoreCategoryStatus({
				sourceStatus: categorySavedAt
					? "Source: local cache (scores-per-category-summary, < 3 months)"
					: "Source: category-linked score cache",
				output: `Loaded ${formatNumber(plotTopCategories.length)} category-linked scoring summaries.`,
			});
		} else if (includeCategoryStats) {
			renderScoreCategoryStatus({
				sourceStatus: "Source: unavailable",
				output: "Error loading category-linked stats: no category data.",
			});
		}

		return results;
	} catch (error) {
		if (includeAllScoreStats && results?.summary) {
			renderScoreStats(results.summary);
			renderScorePlot(results.summary);
			renderScoreTraitStatus({
				sourceStatus: results.source === "cache-fallback"
					? (includeTraitStats
						? "Source: local cache fallback (all-score-summary + scores-per-trait-summary)"
						: "Source: local cache fallback (all-score-summary)")
					: "Source: unavailable",
				output: includeTraitStats
					? `Loaded ${formatNumber(results.summary.totalScores)} cached scores summary + trait-linked score cache (${results.savedAt}).`
					: `Loaded ${formatNumber(results.summary.totalScores)} cached scores summary (${results.savedAt}).`,
			});
		} else if (includeTraitStats) {
			renderScoreTraitStatus({
				sourceStatus: "Source: unavailable",
				output: `Error loading trait-linked stats: ${error.message}`,
			});
		} else {
			renderScoreTraitStatus({
				sourceStatus: "Source: unavailable",
				output: `Error loading stats: ${error.message}`,
			});
		}

		if (includeCategoryStats && scoresPerCategoryPayload?.scoresPerCategory) {
			const categoryTop = buildTopCategoriesFromScoresPerCategory(scoresPerCategoryPayload);
			renderScorePerCategoryStats(categoryTop);
			renderScorePerCategoryPlot(categoryTop);
			renderScoreCategoryStatus({
				sourceStatus: "Source: local cache fallback (scores-per-category-summary)",
				output: `Loaded ${formatNumber(categoryTop.length)} cached category-linked scoring summaries (${scoresPerCategoryPayload.savedAt}).`,
			});
		} else if (includeCategoryStats) {
			renderScoreCategoryStatus({
				sourceStatus: "Source: unavailable",
				output: `Error loading category-linked stats: ${error.message}`,
			});
		}

		console.error(error);
		return results;
	}
}

/*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) */
// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

/* eslint-disable space-unary-ops */

/* Public constants ==========================================================*/
/* ===========================================================================*/


//const Z_FILTERED          = 1;
//const Z_HUFFMAN_ONLY      = 2;
//const Z_RLE               = 3;
const Z_FIXED$1               = 4;
//const Z_DEFAULT_STRATEGY  = 0;

/* Possible values of the data_type field (though see inflate()) */
const Z_BINARY              = 0;
const Z_TEXT                = 1;
//const Z_ASCII             = 1; // = Z_TEXT
const Z_UNKNOWN$1             = 2;

/*============================================================================*/


function zero$1(buf) { let len = buf.length; while (--len >= 0) { buf[len] = 0; } }

// From zutil.h

const STORED_BLOCK = 0;
const STATIC_TREES = 1;
const DYN_TREES    = 2;
/* The three kinds of block type */

const MIN_MATCH$1    = 3;
const MAX_MATCH$1    = 258;
/* The minimum and maximum match lengths */

// From deflate.h
/* ===========================================================================
 * Internal compression state.
 */

const LENGTH_CODES$1  = 29;
/* number of length codes, not counting the special END_BLOCK code */

const LITERALS$1      = 256;
/* number of literal bytes 0..255 */

const L_CODES$1       = LITERALS$1 + 1 + LENGTH_CODES$1;
/* number of Literal or Length codes, including the END_BLOCK code */

const D_CODES$1       = 30;
/* number of distance codes */

const BL_CODES$1      = 19;
/* number of codes used to transfer the bit lengths */

const HEAP_SIZE$1     = 2 * L_CODES$1 + 1;
/* maximum heap size */

const MAX_BITS$1      = 15;
/* All codes must not exceed MAX_BITS bits */

const Buf_size      = 16;
/* size of bit buffer in bi_buf */


/* ===========================================================================
 * Constants
 */

const MAX_BL_BITS = 7;
/* Bit length codes must not exceed MAX_BL_BITS bits */

const END_BLOCK   = 256;
/* end of block literal code */

const REP_3_6     = 16;
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

const REPZ_3_10   = 17;
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

const REPZ_11_138 = 18;
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

/* eslint-disable comma-spacing,array-bracket-spacing */
const extra_lbits =   /* extra bits for each length code */
  new Uint8Array([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]);

const extra_dbits =   /* extra bits for each distance code */
  new Uint8Array([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]);

const extra_blbits =  /* extra bits for each bit length code */
  new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7]);

const bl_order =
  new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]);
/* eslint-enable comma-spacing,array-bracket-spacing */

/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

// We pre-fill arrays with 0 to avoid uninitialized gaps

const DIST_CODE_LEN = 512; /* see definition of array dist_code below */

// !!!! Use flat array instead of structure, Freq = i*2, Len = i*2+1
const static_ltree  = new Array((L_CODES$1 + 2) * 2);
zero$1(static_ltree);
/* The static literal tree. Since the bit lengths are imposed, there is no
 * need for the L_CODES extra codes used during heap construction. However
 * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
 * below).
 */

const static_dtree  = new Array(D_CODES$1 * 2);
zero$1(static_dtree);
/* The static distance tree. (Actually a trivial tree since all codes use
 * 5 bits.)
 */

const _dist_code    = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
/* Distance codes. The first 256 values correspond to the distances
 * 3 .. 258, the last 256 values correspond to the top 8 bits of
 * the 15 bit distances.
 */

const _length_code  = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
zero$1(_length_code);
/* length code for each normalized match length (0 == MIN_MATCH) */

const base_length   = new Array(LENGTH_CODES$1);
zero$1(base_length);
/* First normalized length for each code (0 = MIN_MATCH) */

const base_dist     = new Array(D_CODES$1);
zero$1(base_dist);
/* First normalized distance for each code (0 = distance of 1) */


function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {

  this.static_tree  = static_tree;  /* static tree or NULL */
  this.extra_bits   = extra_bits;   /* extra bits for each code or NULL */
  this.extra_base   = extra_base;   /* base index for extra_bits */
  this.elems        = elems;        /* max number of elements in the tree */
  this.max_length   = max_length;   /* max bit length for the codes */

  // show if `static_tree` has data or dummy - needed for monomorphic objects
  this.has_stree    = static_tree && static_tree.length;
}


let static_l_desc;
let static_d_desc;
let static_bl_desc;


function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;     /* the dynamic tree */
  this.max_code = 0;            /* largest code with non zero frequency */
  this.stat_desc = stat_desc;   /* the corresponding static tree */
}



const d_code = (dist) => {

  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};


/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
const put_short = (s, w) => {
//    put_byte(s, (uch)((w) & 0xff));
//    put_byte(s, (uch)((ush)(w) >> 8));
  s.pending_buf[s.pending++] = (w) & 0xff;
  s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
};


/* ===========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
const send_bits = (s, value, length) => {

  if (s.bi_valid > (Buf_size - length)) {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> (Buf_size - s.bi_valid);
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    s.bi_valid += length;
  }
};


const send_code = (s, c, tree) => {

  send_bits(s, tree[c * 2]/*.Code*/, tree[c * 2 + 1]/*.Len*/);
};


/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
const bi_reverse = (code, len) => {

  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};


/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
const bi_flush = (s) => {

  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;

  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 0xff;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
};


/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
const gen_bitlen = (s, desc) => {
//    deflate_state *s;
//    tree_desc *desc;    /* the tree descriptor */

  const tree            = desc.dyn_tree;
  const max_code        = desc.max_code;
  const stree           = desc.stat_desc.static_tree;
  const has_stree       = desc.stat_desc.has_stree;
  const extra           = desc.stat_desc.extra_bits;
  const base            = desc.stat_desc.extra_base;
  const max_length      = desc.stat_desc.max_length;
  let h;              /* heap index */
  let n, m;           /* iterate over the tree elements */
  let bits;           /* bit length */
  let xbits;          /* extra bits */
  let f;              /* frequency */
  let overflow = 0;   /* number of elements with bit length too large */

  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0;
  }

  /* In a first pass, compute the optimal bit lengths (which may
   * overflow in the case of the bit length tree).
   */
  tree[s.heap[s.heap_max] * 2 + 1]/*.Len*/ = 0; /* root of the heap */

  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1]/*.Dad*/ * 2 + 1]/*.Len*/ + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1]/*.Len*/ = bits;
    /* We overwrite tree[n].Dad which is no longer needed */

    if (n > max_code) { continue; } /* not a leaf node */

    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2]/*.Freq*/;
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1]/*.Len*/ + xbits);
    }
  }
  if (overflow === 0) { return; }

  // Tracev((stderr,"\nbit length overflow\n"));
  /* This happens for example on obj2 and pic of the Calgary corpus */

  /* Find the first bit length which could increase: */
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) { bits--; }
    s.bl_count[bits]--;      /* move one leaf down the tree */
    s.bl_count[bits + 1] += 2; /* move one overflow item as its brother */
    s.bl_count[max_length]--;
    /* The brother of the overflow item also moves one step up,
     * but this does not affect bl_count[max_length]
     */
    overflow -= 2;
  } while (overflow > 0);

  /* Now recompute all bit lengths, scanning in increasing frequency.
   * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
   * lengths instead of fixing only the wrong ones. This idea is taken
   * from 'ar' written by Haruhiko Okumura.)
   */
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) { continue; }
      if (tree[m * 2 + 1]/*.Len*/ !== bits) {
        // Tracev((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
        s.opt_len += (bits - tree[m * 2 + 1]/*.Len*/) * tree[m * 2]/*.Freq*/;
        tree[m * 2 + 1]/*.Len*/ = bits;
      }
      n--;
    }
  }
};


/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
const gen_codes = (tree, max_code, bl_count) => {
//    ct_data *tree;             /* the tree to decorate */
//    int max_code;              /* largest code with non zero frequency */
//    ushf *bl_count;            /* number of codes at each bit length */

  const next_code = new Array(MAX_BITS$1 + 1); /* next code value for each bit length */
  let code = 0;              /* running code value */
  let bits;                  /* bit index */
  let n;                     /* code index */

  /* The distribution counts are first used to generate the code values
   * without bit reversal.
   */
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    code = (code + bl_count[bits - 1]) << 1;
    next_code[bits] = code;
  }
  /* Check that the bit counts in bl_count are consistent. The last code
   * must be all ones.
   */
  //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  //        "inconsistent bit counts");
  //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

  for (n = 0;  n <= max_code; n++) {
    let len = tree[n * 2 + 1]/*.Len*/;
    if (len === 0) { continue; }
    /* Now reverse the bits */
    tree[n * 2]/*.Code*/ = bi_reverse(next_code[len]++, len);

    //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
    //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
  }
};


/* ===========================================================================
 * Initialize the various 'constant' tables.
 */
const tr_static_init = () => {

  let n;        /* iterates over tree elements */
  let bits;     /* bit counter */
  let length;   /* length value */
  let code;     /* code value */
  let dist;     /* distance index */
  const bl_count = new Array(MAX_BITS$1 + 1);
  /* number of codes at each bit length for an optimal tree */

  // do check in _tr_init()
  //if (static_init_done) return;

  /* For some embedded targets, global variables are not initialized: */
/*#ifdef NO_INIT_GLOBAL_POINTERS
  static_l_desc.static_tree = static_ltree;
  static_l_desc.extra_bits = extra_lbits;
  static_d_desc.static_tree = static_dtree;
  static_d_desc.extra_bits = extra_dbits;
  static_bl_desc.extra_bits = extra_blbits;
#endif*/

  /* Initialize the mapping length (0..255) -> length code (0..28) */
  length = 0;
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < (1 << extra_lbits[code]); n++) {
      _length_code[length++] = code;
    }
  }
  //Assert (length == 256, "tr_static_init: length != 256");
  /* Note that the length 255 (match length 258) can be represented
   * in two different ways: code 284 + 5 bits or code 285, so we
   * overwrite length_code[255] to use the best encoding:
   */
  _length_code[length - 1] = code;

  /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < (1 << extra_dbits[code]); n++) {
      _dist_code[dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: dist != 256");
  dist >>= 7; /* from now on, all distances are divided by 128 */
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < (1 << (extra_dbits[code] - 7)); n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: 256+dist != 512");

  /* Construct the codes of the static literal tree */
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0;
  }

  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1]/*.Len*/ = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1]/*.Len*/ = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  /* Codes 286 and 287 do not exist, but we must include them in the
   * tree construction to get a canonical Huffman tree (longest code
   * all ones)
   */
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count);

  /* The static distance tree is trivial: */
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1]/*.Len*/ = 5;
    static_dtree[n * 2]/*.Code*/ = bi_reverse(n, 5);
  }

  // Now data ready and we can init static trees
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0,          D_CODES$1, MAX_BITS$1);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0,         BL_CODES$1, MAX_BL_BITS);

  //static_init_done = true;
};


/* ===========================================================================
 * Initialize a new block.
 */
const init_block = (s) => {

  let n; /* iterates over tree elements */

  /* Initialize the trees. */
  for (n = 0; n < L_CODES$1;  n++) { s.dyn_ltree[n * 2]/*.Freq*/ = 0; }
  for (n = 0; n < D_CODES$1;  n++) { s.dyn_dtree[n * 2]/*.Freq*/ = 0; }
  for (n = 0; n < BL_CODES$1; n++) { s.bl_tree[n * 2]/*.Freq*/ = 0; }

  s.dyn_ltree[END_BLOCK * 2]/*.Freq*/ = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};


/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
const bi_windup = (s) =>
{
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    //put_byte(s, (Byte)s->bi_buf);
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
};

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
const smaller = (tree, n, m, depth) => {

  const _n2 = n * 2;
  const _m2 = m * 2;
  return (tree[_n2]/*.Freq*/ < tree[_m2]/*.Freq*/ ||
         (tree[_n2]/*.Freq*/ === tree[_m2]/*.Freq*/ && depth[n] <= depth[m]));
};

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
const pqdownheap = (s, tree, k) => {
//    deflate_state *s;
//    ct_data *tree;  /* the tree to restore */
//    int k;               /* node to move down */

  const v = s.heap[k];
  let j = k << 1;  /* left son of k */
  while (j <= s.heap_len) {
    /* Set j to the smallest of the two sons: */
    if (j < s.heap_len &&
      smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    /* Exit if v is smaller than both sons */
    if (smaller(tree, v, s.heap[j], s.depth)) { break; }

    /* Exchange v with the smallest son */
    s.heap[k] = s.heap[j];
    k = j;

    /* And continue down the tree, setting j to the left son of k */
    j <<= 1;
  }
  s.heap[k] = v;
};


// inlined manually
// const SMALLEST = 1;

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
const compress_block = (s, ltree, dtree) => {
//    deflate_state *s;
//    const ct_data *ltree; /* literal tree */
//    const ct_data *dtree; /* distance tree */

  let dist;           /* distance of matched string */
  let lc;             /* match length or unmatched char (if dist == 0) */
  let sx = 0;         /* running index in sym_buf */
  let code;           /* the code to send */
  let extra;          /* number of extra bits to send */

  if (s.sym_next !== 0) {
    do {
      dist = s.pending_buf[s.sym_buf + sx++] & 0xff;
      dist += (s.pending_buf[s.sym_buf + sx++] & 0xff) << 8;
      lc = s.pending_buf[s.sym_buf + sx++];
      if (dist === 0) {
        send_code(s, lc, ltree); /* send a literal byte */
        //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
      } else {
        /* Here, lc is the match length - MIN_MATCH */
        code = _length_code[lc];
        send_code(s, code + LITERALS$1 + 1, ltree); /* send the length code */
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);       /* send the extra length bits */
        }
        dist--; /* dist is now the match distance - 1 */
        code = d_code(dist);
        //Assert (code < D_CODES, "bad d_code");

        send_code(s, code, dtree);       /* send the distance code */
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);   /* send the extra distance bits */
        }
      } /* literal or match pair ? */

      /* Check that the overlay between pending_buf and sym_buf is ok: */
      //Assert(s->pending < s->lit_bufsize + sx, "pendingBuf overflow");

    } while (sx < s.sym_next);
  }

  send_code(s, END_BLOCK, ltree);
};


/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
const build_tree = (s, desc) => {
//    deflate_state *s;
//    tree_desc *desc; /* the tree descriptor */

  const tree     = desc.dyn_tree;
  const stree    = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems    = desc.stat_desc.elems;
  let n, m;          /* iterate over heap elements */
  let max_code = -1; /* largest code with non zero frequency */
  let node;          /* new node being created */

  /* Construct the initial heap, with least frequent element in
   * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
   * heap[0] is not used.
   */
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;

  for (n = 0; n < elems; n++) {
    if (tree[n * 2]/*.Freq*/ !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;

    } else {
      tree[n * 2 + 1]/*.Len*/ = 0;
    }
  }

  /* The pkzip format requires that at least one distance code exists,
   * and that at least one bit should be sent even if there is only one
   * possible code. So to avoid special checks later on we force at least
   * two codes of non zero frequency.
   */
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
    tree[node * 2]/*.Freq*/ = 1;
    s.depth[node] = 0;
    s.opt_len--;

    if (has_stree) {
      s.static_len -= stree[node * 2 + 1]/*.Len*/;
    }
    /* node is 0 or 1 so it does not have extra bits */
  }
  desc.max_code = max_code;

  /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
   * establish sub-heaps of increasing lengths:
   */
  for (n = (s.heap_len >> 1/*int /2*/); n >= 1; n--) { pqdownheap(s, tree, n); }

  /* Construct the Huffman tree by repeatedly combining the least two
   * frequent nodes.
   */
  node = elems;              /* next internal node of the tree */
  do {
    //pqremove(s, tree, n);  /* n = node of least frequency */
    /*** pqremove ***/
    n = s.heap[1/*SMALLEST*/];
    s.heap[1/*SMALLEST*/] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1/*SMALLEST*/);
    /***/

    m = s.heap[1/*SMALLEST*/]; /* m = node of next least frequency */

    s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
    s.heap[--s.heap_max] = m;

    /* Create a new node father of n and m */
    tree[node * 2]/*.Freq*/ = tree[n * 2]/*.Freq*/ + tree[m * 2]/*.Freq*/;
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1]/*.Dad*/ = tree[m * 2 + 1]/*.Dad*/ = node;

    /* and insert the new node in the heap */
    s.heap[1/*SMALLEST*/] = node++;
    pqdownheap(s, tree, 1/*SMALLEST*/);

  } while (s.heap_len >= 2);

  s.heap[--s.heap_max] = s.heap[1/*SMALLEST*/];

  /* At this point, the fields freq and dad are set. We can now
   * generate the bit lengths.
   */
  gen_bitlen(s, desc);

  /* The field len is now set, we can generate the bit codes */
  gen_codes(tree, max_code, s.bl_count);
};


/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
const scan_tree = (s, tree, max_code) => {
//    deflate_state *s;
//    ct_data *tree;   /* the tree to be scanned */
//    int max_code;    /* and its largest code of non zero frequency */

  let n;                     /* iterates over all tree elements */
  let prevlen = -1;          /* last emitted length */
  let curlen;                /* length of current code */

  let nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */

  let count = 0;             /* repeat count of the current code */
  let max_count = 7;         /* max repeat count */
  let min_count = 4;         /* min repeat count */

  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1]/*.Len*/ = 0xffff; /* guard */

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      s.bl_tree[curlen * 2]/*.Freq*/ += count;

    } else if (curlen !== 0) {

      if (curlen !== prevlen) { s.bl_tree[curlen * 2]/*.Freq*/++; }
      s.bl_tree[REP_3_6 * 2]/*.Freq*/++;

    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]/*.Freq*/++;

    } else {
      s.bl_tree[REPZ_11_138 * 2]/*.Freq*/++;
    }

    count = 0;
    prevlen = curlen;

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};


/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
const send_tree = (s, tree, max_code) => {
//    deflate_state *s;
//    ct_data *tree; /* the tree to be scanned */
//    int max_code;       /* and its largest code of non zero frequency */

  let n;                     /* iterates over all tree elements */
  let prevlen = -1;          /* last emitted length */
  let curlen;                /* length of current code */

  let nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */

  let count = 0;             /* repeat count of the current code */
  let max_count = 7;         /* max repeat count */
  let min_count = 4;         /* min repeat count */

  /* tree[max_code+1].Len = -1; */  /* guard already set */
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      do { send_code(s, curlen, s.bl_tree); } while (--count !== 0);

    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      //Assert(count >= 3 && count <= 6, " 3_6?");
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);

    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);

    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }

    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};


/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
const build_bl_tree = (s) => {

  let max_blindex;  /* index of last bit length code of non zero freq */

  /* Determine the bit length frequencies for literal and distance trees */
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

  /* Build the bit length tree: */
  build_tree(s, s.bl_desc);
  /* opt_len now includes the length of the tree representations, except
   * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
   */

  /* Determine the number of bit length codes to send. The pkzip format
   * requires that at least 4 bit length codes be sent. (appnote.txt says
   * 3 but the actual value used is 4.)
   */
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1]/*.Len*/ !== 0) {
      break;
    }
  }
  /* Update opt_len to include the bit length tree and counts */
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
  //        s->opt_len, s->static_len));

  return max_blindex;
};


/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
const send_all_trees = (s, lcodes, dcodes, blcodes) => {
//    deflate_state *s;
//    int lcodes, dcodes, blcodes; /* number of codes for each tree */

  let rank;                    /* index in bl_order */

  //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
  //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
  //        "too many codes");
  //Tracev((stderr, "\nbl counts: "));
  send_bits(s, lcodes - 257, 5); /* not +255 as stated in appnote.txt */
  send_bits(s, dcodes - 1,   5);
  send_bits(s, blcodes - 4,  4); /* not -3 as stated in appnote.txt */
  for (rank = 0; rank < blcodes; rank++) {
    //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
    send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1]/*.Len*/, 3);
  }
  //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_ltree, lcodes - 1); /* literal tree */
  //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_dtree, dcodes - 1); /* distance tree */
  //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
};


/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "block list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "allow list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
const detect_data_type = (s) => {
  /* block_mask is the bit mask of block-listed bytes
   * set bits 0..6, 14..25, and 28..31
   * 0xf3ffc07f = binary 11110011111111111100000001111111
   */
  let block_mask = 0xf3ffc07f;
  let n;

  /* Check for non-textual ("block-listed") bytes. */
  for (n = 0; n <= 31; n++, block_mask >>>= 1) {
    if ((block_mask & 1) && (s.dyn_ltree[n * 2]/*.Freq*/ !== 0)) {
      return Z_BINARY;
    }
  }

  /* Check for textual ("allow-listed") bytes. */
  if (s.dyn_ltree[9 * 2]/*.Freq*/ !== 0 || s.dyn_ltree[10 * 2]/*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2]/*.Freq*/ !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2]/*.Freq*/ !== 0) {
      return Z_TEXT;
    }
  }

  /* There are no "block-listed" or "allow-listed" bytes:
   * this stream either is empty or has tolerated ("gray-listed") bytes only.
   */
  return Z_BINARY;
};


let static_init_done = false;

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
const _tr_init$1 = (s) =>
{

  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }

  s.l_desc  = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc  = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

  s.bi_buf = 0;
  s.bi_valid = 0;

  /* Initialize the first block of the first file: */
  init_block(s);
};


/* ===========================================================================
 * Send a stored block
 */
const _tr_stored_block$1 = (s, buf, stored_len, last) => {
//DeflateState *s;
//charf *buf;       /* input block */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */

  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);    /* send block type */
  bi_windup(s);        /* align on byte boundary */
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len) {
    s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  }
  s.pending += stored_len;
};


/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
const _tr_align$1 = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};


/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and write out the encoded block.
 */
const _tr_flush_block$1 = (s, buf, stored_len, last) => {
//DeflateState *s;
//charf *buf;       /* input block, or NULL if too old */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */

  let opt_lenb, static_lenb;  /* opt_len and static_len in bytes */
  let max_blindex = 0;        /* index of last bit length code of non zero freq */

  /* Build the Huffman trees unless a stored block is forced */
  if (s.level > 0) {

    /* Check if the file is binary or text */
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s);
    }

    /* Construct the literal and distance trees */
    build_tree(s, s.l_desc);
    // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));

    build_tree(s, s.d_desc);
    // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = build_bl_tree(s);

    /* Determine the best encoding. Compute the block lengths in bytes. */
    opt_lenb = (s.opt_len + 3 + 7) >>> 3;
    static_lenb = (s.static_len + 3 + 7) >>> 3;

    // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
    //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
    //        s->sym_next / 3));

    if (static_lenb <= opt_lenb) { opt_lenb = static_lenb; }

  } else {
    // Assert(buf != (char*)0, "lost buf");
    opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
  }

  if ((stored_len + 4 <= opt_lenb) && (buf !== -1)) {
    /* 4: two words for the lengths */

    /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
     * Otherwise we can't have processed more than WSIZE input bytes since
     * the last block flush, because compression would have been
     * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
     * transform a block into a stored block.
     */
    _tr_stored_block$1(s, buf, stored_len, last);

  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {

    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);

  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
  /* The above check is made mod 2^32, for files larger than 512 MB
   * and uLong implemented on 32 bits.
   */
  init_block(s);

  if (last) {
    bi_windup(s);
  }
  // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
  //       s->compressed_len-7*last));
};

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
const _tr_tally$1 = (s, dist, lc) => {
//    deflate_state *s;
//    unsigned dist;  /* distance of matched string */
//    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */

  s.pending_buf[s.sym_buf + s.sym_next++] = dist;
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
  s.pending_buf[s.sym_buf + s.sym_next++] = lc;
  if (dist === 0) {
    /* lc is the unmatched char */
    s.dyn_ltree[lc * 2]/*.Freq*/++;
  } else {
    s.matches++;
    /* Here, lc is the match length - MIN_MATCH */
    dist--;             /* dist = match distance - 1 */
    //Assert((ush)dist < (ush)MAX_DIST(s) &&
    //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
    //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]/*.Freq*/++;
    s.dyn_dtree[d_code(dist) * 2]/*.Freq*/++;
  }

  return (s.sym_next === s.sym_end);
};

var _tr_init_1  = _tr_init$1;
var _tr_stored_block_1 = _tr_stored_block$1;
var _tr_flush_block_1  = _tr_flush_block$1;
var _tr_tally_1 = _tr_tally$1;
var _tr_align_1 = _tr_align$1;

var trees = {
	_tr_init: _tr_init_1,
	_tr_stored_block: _tr_stored_block_1,
	_tr_flush_block: _tr_flush_block_1,
	_tr_tally: _tr_tally_1,
	_tr_align: _tr_align_1
};

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It isn't worth it to make additional optimizations as in original.
// Small size is preferable.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const adler32 = (adler, buf, len, pos) => {
  let s1 = (adler & 0xffff) |0,
      s2 = ((adler >>> 16) & 0xffff) |0,
      n = 0;

  while (len !== 0) {
    // Set limit ~ twice less than 5552, to keep
    // s2 in 31-bits, because we force signed ints.
    // in other case %= will fail.
    n = len > 2000 ? 2000 : len;
    len -= n;

    do {
      s1 = (s1 + buf[pos++]) |0;
      s2 = (s2 + s1) |0;
    } while (--n);

    s1 %= 65521;
    s2 %= 65521;
  }

  return (s1 | (s2 << 16)) |0;
};


var adler32_1 = adler32;

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// Use ordinary array, since untyped makes no boost here
const makeTable = () => {
  let c, table = [];

  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }

  return table;
};

// Create table on load. Just 255 signed longs. Not a problem.
const crcTable = new Uint32Array(makeTable());


const crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;

  crc ^= -1;

  for (let i = pos; i < end; i++) {
    crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
  }

  return (crc ^ (-1)); // >>> 0;
};


var crc32_1 = crc32;

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var messages = {
  2:      'need dictionary',     /* Z_NEED_DICT       2  */
  1:      'stream end',          /* Z_STREAM_END      1  */
  0:      '',                    /* Z_OK              0  */
  '-1':   'file error',          /* Z_ERRNO         (-1) */
  '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
  '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
  '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
  '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
  '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var constants$2 = {

  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH:         0,
  Z_PARTIAL_FLUSH:    1,
  Z_SYNC_FLUSH:       2,
  Z_FULL_FLUSH:       3,
  Z_FINISH:           4,
  Z_BLOCK:            5,
  Z_TREES:            6,

  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK:               0,
  Z_STREAM_END:       1,
  Z_NEED_DICT:        2,
  Z_ERRNO:           -1,
  Z_STREAM_ERROR:    -2,
  Z_DATA_ERROR:      -3,
  Z_MEM_ERROR:       -4,
  Z_BUF_ERROR:       -5,
  //Z_VERSION_ERROR: -6,

  /* compression levels */
  Z_NO_COMPRESSION:         0,
  Z_BEST_SPEED:             1,
  Z_BEST_COMPRESSION:       9,
  Z_DEFAULT_COMPRESSION:   -1,


  Z_FILTERED:               1,
  Z_HUFFMAN_ONLY:           2,
  Z_RLE:                    3,
  Z_FIXED:                  4,
  Z_DEFAULT_STRATEGY:       0,

  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY:                 0,
  Z_TEXT:                   1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN:                2,

  /* The deflate compression method */
  Z_DEFLATED:               8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;




/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH: Z_NO_FLUSH$2, Z_PARTIAL_FLUSH, Z_FULL_FLUSH: Z_FULL_FLUSH$1, Z_FINISH: Z_FINISH$3, Z_BLOCK: Z_BLOCK$1,
  Z_OK: Z_OK$3, Z_STREAM_END: Z_STREAM_END$3, Z_STREAM_ERROR: Z_STREAM_ERROR$2, Z_DATA_ERROR: Z_DATA_ERROR$2, Z_BUF_ERROR: Z_BUF_ERROR$1,
  Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
  Z_FILTERED, Z_HUFFMAN_ONLY, Z_RLE, Z_FIXED, Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
  Z_UNKNOWN,
  Z_DEFLATED: Z_DEFLATED$2
} = constants$2;

/*============================================================================*/


const MAX_MEM_LEVEL = 9;
/* Maximum value for memLevel in deflateInit2 */
const MAX_WBITS$1 = 15;
/* 32K LZ77 window */
const DEF_MEM_LEVEL = 8;


const LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */
const LITERALS      = 256;
/* number of literal bytes 0..255 */
const L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */
const D_CODES       = 30;
/* number of distance codes */
const BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */
const HEAP_SIZE     = 2 * L_CODES + 1;
/* maximum heap size */
const MAX_BITS  = 15;
/* All codes must not exceed MAX_BITS bits */

const MIN_MATCH = 3;
const MAX_MATCH = 258;
const MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

const PRESET_DICT = 0x20;

const INIT_STATE    =  42;    /* zlib header -> BUSY_STATE */
//#ifdef GZIP
const GZIP_STATE    =  57;    /* gzip header -> BUSY_STATE | EXTRA_STATE */
//#endif
const EXTRA_STATE   =  69;    /* gzip extra block -> NAME_STATE */
const NAME_STATE    =  73;    /* gzip file name -> COMMENT_STATE */
const COMMENT_STATE =  91;    /* gzip comment -> HCRC_STATE */
const HCRC_STATE    = 103;    /* gzip header CRC -> BUSY_STATE */
const BUSY_STATE    = 113;    /* deflate -> FINISH_STATE */
const FINISH_STATE  = 666;    /* stream complete */

const BS_NEED_MORE      = 1; /* block not completed, need more input or more output */
const BS_BLOCK_DONE     = 2; /* block flush performed */
const BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
const BS_FINISH_DONE    = 4; /* finish done, accept no more input or output */

const OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

const err = (strm, errorCode) => {
  strm.msg = messages[errorCode];
  return errorCode;
};

const rank = (f) => {
  return ((f) * 2) - ((f) > 4 ? 9 : 0);
};

const zero = (buf) => {
  let len = buf.length; while (--len >= 0) { buf[len] = 0; }
};

/* ===========================================================================
 * Slide the hash table when sliding the window down (could be avoided with 32
 * bit values at the expense of memory usage). We slide even when level == 0 to
 * keep the hash table consistent if we switch back to level > 0 later.
 */
const slide_hash = (s) => {
  let n, m;
  let p;
  let wsize = s.w_size;

  n = s.hash_size;
  p = n;
  do {
    m = s.head[--p];
    s.head[p] = (m >= wsize ? m - wsize : 0);
  } while (--n);
  n = wsize;
//#ifndef FASTEST
  p = n;
  do {
    m = s.prev[--p];
    s.prev[p] = (m >= wsize ? m - wsize : 0);
    /* If n is not on any hash chain, prev[n] is garbage but
     * its value will never be used.
     */
  } while (--n);
//#endif
};

/* eslint-disable new-cap */
let HASH_ZLIB = (s, prev, data) => ((prev << s.hash_shift) ^ data) & s.hash_mask;
// This hash causes less collisions, https://github.com/nodeca/pako/issues/135
// But breaks binary compatibility
//let HASH_FAST = (s, prev, data) => ((prev << 8) + (prev >> 8) + (data << 4)) & s.hash_mask;
let HASH = HASH_ZLIB;


/* =========================================================================
 * Flush as much pending output as possible. All deflate() output, except for
 * some deflate_stored() output, goes through this function so some
 * applications may wish to modify it to avoid allocating a large
 * strm->next_out buffer and copying into it. (See also read_buf()).
 */
const flush_pending = (strm) => {
  const s = strm.state;

  //_tr_flush_bits(s);
  let len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) { return; }

  strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
  strm.next_out  += len;
  s.pending_out  += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending      -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
};


const flush_block_only = (s, last) => {
  _tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};


const put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};


/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
const putShortMSB = (s, b) => {

  //  put_byte(s, (Byte)(b >> 8));
//  put_byte(s, (Byte)(b & 0xff));
  s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
  s.pending_buf[s.pending++] = b & 0xff;
};


/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm->input buffer and copying from it.
 * (See also flush_pending()).
 */
const read_buf = (strm, buf, start, size) => {

  let len = strm.avail_in;

  if (len > size) { len = size; }
  if (len === 0) { return 0; }

  strm.avail_in -= len;

  // zmemcpy(buf, strm->next_in, len);
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32_1(strm.adler, buf, len, start);
  }

  else if (strm.state.wrap === 2) {
    strm.adler = crc32_1(strm.adler, buf, len, start);
  }

  strm.next_in += len;
  strm.total_in += len;

  return len;
};


/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
const longest_match = (s, cur_match) => {

  let chain_length = s.max_chain_length;      /* max hash chain length */
  let scan = s.strstart; /* current string */
  let match;                       /* matched string */
  let len;                           /* length of current match */
  let best_len = s.prev_length;              /* best match length so far */
  let nice_match = s.nice_match;             /* stop if match long enough */
  const limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
      s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0/*NIL*/;

  const _win = s.window; // shortcut

  const wmask = s.w_mask;
  const prev  = s.prev;

  /* Stop when cur_match becomes <= limit. To simplify the code,
   * we prevent matches with the string of window index 0.
   */

  const strend = s.strstart + MAX_MATCH;
  let scan_end1  = _win[scan + best_len - 1];
  let scan_end   = _win[scan + best_len];

  /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
   * It is easy to get rid of this optimization if necessary.
   */
  // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

  /* Do not waste too much time if we already have a good match: */
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  /* Do not look for matches beyond the end of the input. This is necessary
   * to make deflate deterministic.
   */
  if (nice_match > s.lookahead) { nice_match = s.lookahead; }

  // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

  do {
    // Assert(cur_match < s->strstart, "no future");
    match = cur_match;

    /* Skip to next match if the match length cannot increase
     * or if the match length is less than 2.  Note that the checks below
     * for insufficient lookahead only occur occasionally for performance
     * reasons.  Therefore uninitialized memory will be accessed, and
     * conditional jumps will be made that depend on those values.
     * However the length of the match is limited to the lookahead, so
     * the output of deflate is not affected by the uninitialized values.
     */

    if (_win[match + best_len]     !== scan_end  ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match]                !== _win[scan] ||
        _win[++match]              !== _win[scan + 1]) {
      continue;
    }

    /* The check at best_len-1 can be removed because it will be made
     * again later. (This heuristic is not always a win.)
     * It is not necessary to compare scan[2] and match[2] since they
     * are always equal when the other bytes match, given that
     * the hash keys are equal and that HASH_BITS >= 8.
     */
    scan += 2;
    match++;
    // Assert(*scan == *match, "match[2]?");

    /* We check for insufficient lookahead only every 8th comparison;
     * the 256th check will be made at strstart+258.
     */
    do {
      /*jshint noempty:false*/
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             scan < strend);

    // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;

    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1  = _win[scan + best_len - 1];
      scan_end   = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
};


/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
const fill_window = (s) => {

  const _w_size = s.w_size;
  let n, more, str;

  //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

  do {
    more = s.window_size - s.lookahead - s.strstart;

    // JS ints have 32 bit, block below not needed
    /* Deal with !@#$% 64K limit: */
    //if (sizeof(int) <= 2) {
    //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
    //        more = wsize;
    //
    //  } else if (more == (unsigned)(-1)) {
    //        /* Very unlikely, but possible on 16 bit machine if
    //         * strstart == 0 && lookahead == 1 (input done a byte at time)
    //         */
    //        more--;
    //    }
    //}


    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      /* we now have strstart >= MAX_DIST */
      s.block_start -= _w_size;
      if (s.insert > s.strstart) {
        s.insert = s.strstart;
      }
      slide_hash(s);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }

    /* If there was no sliding:
     *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
     *    more == window_size - lookahead - strstart
     * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
     * => more >= window_size - 2*WSIZE + 2
     * In the BIG_MEM or MMAP case (not yet supported),
     *   window_size == input_size + MIN_LOOKAHEAD  &&
     *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
     * Otherwise, window_size == 2*WSIZE so more >= 2.
     * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
     */
    //Assert(more >= 2, "more < 2");
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;

    /* Initialize the hash value now that we have some input: */
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];

      /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
//#if MIN_MATCH != 3
//        Call update_hash() MIN_MATCH-3 more times
//#endif
      while (s.insert) {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);

        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
    /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
     * but this is not important since only literal bytes will be emitted.
     */

  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

  /* If the WIN_INIT bytes after the end of the current data have never been
   * written, then zero those bytes in order to avoid memory check reports of
   * the use of uninitialized (or uninitialised as Julian writes) bytes by
   * the longest match routines.  Update the high water mark for the next
   * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
   * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
   */
//  if (s.high_water < s.window_size) {
//    const curr = s.strstart + s.lookahead;
//    let init = 0;
//
//    if (s.high_water < curr) {
//      /* Previous high water mark below current data -- zero WIN_INIT
//       * bytes or up to end of window, whichever is less.
//       */
//      init = s.window_size - curr;
//      if (init > WIN_INIT)
//        init = WIN_INIT;
//      zmemzero(s->window + curr, (unsigned)init);
//      s->high_water = curr + init;
//    }
//    else if (s->high_water < (ulg)curr + WIN_INIT) {
//      /* High water mark at or above current data, but below current data
//       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
//       * to end of window, whichever is less.
//       */
//      init = (ulg)curr + WIN_INIT - s->high_water;
//      if (init > s->window_size - s->high_water)
//        init = s->window_size - s->high_water;
//      zmemzero(s->window + s->high_water, (unsigned)init);
//      s->high_water += init;
//    }
//  }
//
//  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
//    "not enough room for search");
};

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 *
 * In case deflateParams() is used to later switch to a non-zero compression
 * level, s->matches (otherwise unused when storing) keeps track of the number
 * of hash table slides to perform. If s->matches is 1, then one hash table
 * slide will be done when switching. If s->matches is 2, the maximum value
 * allowed here, then the hash table will be cleared, since two or more slides
 * is the same as a clear.
 *
 * deflate_stored() is written to minimize the number of times an input byte is
 * copied. It is most efficient with large input and output buffers, which
 * maximizes the opportunites to have a single copy from next_in to next_out.
 */
const deflate_stored = (s, flush) => {

  /* Smallest worthy block size when not flushing or finishing. By default
   * this is 32K. This can be as small as 507 bytes for memLevel == 1. For
   * large input and output buffers, the stored block size will be larger.
   */
  let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;

  /* Copy as many min_block or larger stored blocks directly to next_out as
   * possible. If flushing, copy the remaining available input to next_out as
   * stored blocks, if there is enough space.
   */
  let len, left, have, last = 0;
  let used = s.strm.avail_in;
  do {
    /* Set len to the maximum size block that we can copy directly with the
     * available input data and output space. Set left to how much of that
     * would be copied from what's left in the window.
     */
    len = 65535/* MAX_STORED */;     /* maximum deflate stored block length */
    have = (s.bi_valid + 42) >> 3;     /* number of header bytes */
    if (s.strm.avail_out < have) {         /* need room for header */
      break;
    }
      /* maximum stored block length that will fit in avail_out: */
    have = s.strm.avail_out - have;
    left = s.strstart - s.block_start;  /* bytes left in window */
    if (len > left + s.strm.avail_in) {
      len = left + s.strm.avail_in;   /* limit len to the input */
    }
    if (len > have) {
      len = have;             /* limit len to the output */
    }

    /* If the stored block would be less than min_block in length, or if
     * unable to copy all of the available input when flushing, then try
     * copying to the window and the pending buffer instead. Also don't
     * write an empty block when flushing -- deflate() does that.
     */
    if (len < min_block && ((len === 0 && flush !== Z_FINISH$3) ||
                        flush === Z_NO_FLUSH$2 ||
                        len !== left + s.strm.avail_in)) {
      break;
    }

    /* Make a dummy stored block in pending to get the header bytes,
     * including any pending bits. This also updates the debugging counts.
     */
    last = flush === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0;
    _tr_stored_block(s, 0, 0, last);

    /* Replace the lengths in the dummy stored block with len. */
    s.pending_buf[s.pending - 4] = len;
    s.pending_buf[s.pending - 3] = len >> 8;
    s.pending_buf[s.pending - 2] = ~len;
    s.pending_buf[s.pending - 1] = ~len >> 8;

    /* Write the stored block header bytes. */
    flush_pending(s.strm);

//#ifdef ZLIB_DEBUG
//    /* Update debugging counts for the data about to be copied. */
//    s->compressed_len += len << 3;
//    s->bits_sent += len << 3;
//#endif

    /* Copy uncompressed bytes from the window to next_out. */
    if (left) {
      if (left > len) {
        left = len;
      }
      //zmemcpy(s->strm->next_out, s->window + s->block_start, left);
      s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
      s.strm.next_out += left;
      s.strm.avail_out -= left;
      s.strm.total_out += left;
      s.block_start += left;
      len -= left;
    }

    /* Copy uncompressed bytes directly from next_in to next_out, updating
     * the check value.
     */
    if (len) {
      read_buf(s.strm, s.strm.output, s.strm.next_out, len);
      s.strm.next_out += len;
      s.strm.avail_out -= len;
      s.strm.total_out += len;
    }
  } while (last === 0);

  /* Update the sliding window with the last s->w_size bytes of the copied
   * data, or append all of the copied data to the existing window if less
   * than s->w_size bytes were copied. Also update the number of bytes to
   * insert in the hash tables, in the event that deflateParams() switches to
   * a non-zero compression level.
   */
  used -= s.strm.avail_in;    /* number of input bytes directly copied */
  if (used) {
    /* If any input was used, then no unused input remains in the window,
     * therefore s->block_start == s->strstart.
     */
    if (used >= s.w_size) {  /* supplant the previous history */
      s.matches = 2;     /* clear hash */
      //zmemcpy(s->window, s->strm->next_in - s->w_size, s->w_size);
      s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
      s.strstart = s.w_size;
      s.insert = s.strstart;
    }
    else {
      if (s.window_size - s.strstart <= used) {
        /* Slide the window down. */
        s.strstart -= s.w_size;
        //zmemcpy(s->window, s->window + s->w_size, s->strstart);
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
        if (s.matches < 2) {
          s.matches++;   /* add a pending slide_hash() */
        }
        if (s.insert > s.strstart) {
          s.insert = s.strstart;
        }
      }
      //zmemcpy(s->window + s->strstart, s->strm->next_in - used, used);
      s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
      s.strstart += used;
      s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
    }
    s.block_start = s.strstart;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }

  /* If the last block was written to next_out, then done. */
  if (last) {
    return BS_FINISH_DONE;
  }

  /* If flushing and all input has been consumed, then done. */
  if (flush !== Z_NO_FLUSH$2 && flush !== Z_FINISH$3 &&
    s.strm.avail_in === 0 && s.strstart === s.block_start) {
    return BS_BLOCK_DONE;
  }

  /* Fill the window with any remaining input. */
  have = s.window_size - s.strstart;
  if (s.strm.avail_in > have && s.block_start >= s.w_size) {
    /* Slide the window down. */
    s.block_start -= s.w_size;
    s.strstart -= s.w_size;
    //zmemcpy(s->window, s->window + s->w_size, s->strstart);
    s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
    if (s.matches < 2) {
      s.matches++;       /* add a pending slide_hash() */
    }
    have += s.w_size;      /* more space now */
    if (s.insert > s.strstart) {
      s.insert = s.strstart;
    }
  }
  if (have > s.strm.avail_in) {
    have = s.strm.avail_in;
  }
  if (have) {
    read_buf(s.strm, s.window, s.strstart, have);
    s.strstart += have;
    s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }

  /* There was not enough avail_out to write a complete worthy or flushed
   * stored block to next_out. Write a stored block to pending instead, if we
   * have enough input for a worthy block, or if flushing and there is enough
   * room for the remaining input as a stored block in the pending buffer.
   */
  have = (s.bi_valid + 42) >> 3;     /* number of header bytes */
    /* maximum stored block length that will fit in pending: */
  have = s.pending_buf_size - have > 65535/* MAX_STORED */ ? 65535/* MAX_STORED */ : s.pending_buf_size - have;
  min_block = have > s.w_size ? s.w_size : have;
  left = s.strstart - s.block_start;
  if (left >= min_block ||
     ((left || flush === Z_FINISH$3) && flush !== Z_NO_FLUSH$2 &&
     s.strm.avail_in === 0 && left <= have)) {
    len = left > have ? have : left;
    last = flush === Z_FINISH$3 && s.strm.avail_in === 0 &&
         len === left ? 1 : 0;
    _tr_stored_block(s, s.block_start, len, last);
    s.block_start += len;
    flush_pending(s.strm);
  }

  /* We've done all we can with the available input and output. */
  return last ? BS_FINISH_STARTED : BS_NEED_MORE;
};


/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
const deflate_fast = (s, flush) => {

  let hash_head;        /* head of the hash chain */
  let bflush;           /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break; /* flush the current block */
      }
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     * At this point we have always match_length < MIN_MATCH
     */
    if (hash_head !== 0/*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */
    }
    if (s.match_length >= MIN_MATCH) {
      // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

      /*** _tr_tally_dist(s, s.strstart - s.match_start,
                     s.match_length - MIN_MATCH, bflush); ***/
      bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;

      /* Insert new strings in the hash table only if the match length
       * is not too large. This saves time but degrades compression.
       */
      if (s.match_length <= s.max_lazy_match/*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
        s.match_length--; /* string at strstart already in table */
        do {
          s.strstart++;
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
          /* strstart never exceeds WSIZE-MAX_MATCH, so there are
           * always MIN_MATCH bytes ahead.
           */
        } while (--s.match_length !== 0);
        s.strstart++;
      } else
      {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);

//#if MIN_MATCH != 3
//                Call UPDATE_HASH() MIN_MATCH-3 more times
//#endif
        /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
         * matter since it will be recomputed at next deflate call.
         */
      }
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s.window[s.strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = ((s.strstart < (MIN_MATCH - 1)) ? s.strstart : MIN_MATCH - 1);
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
};

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
const deflate_slow = (s, flush) => {

  let hash_head;          /* head of hash chain */
  let bflush;              /* set if current block must be flushed */

  let max_insert;

  /* Process the input block. */
  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     */
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;

    if (hash_head !== 0/*NIL*/ && s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= (s.w_size - MIN_LOOKAHEAD)/*MAX_DIST(s)*/) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */

      if (s.match_length <= 5 &&
         (s.strategy === Z_FILTERED || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096/*TOO_FAR*/))) {

        /* If prev_match is also MIN_MATCH, match_start is garbage
         * but we will ignore the current match anyway.
         */
        s.match_length = MIN_MATCH - 1;
      }
    }
    /* If there was a match at the previous step and the current
     * match is not better, output the previous match:
     */
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      /* Do not insert strings in hash table beyond this. */

      //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

      /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                     s.prev_length - MIN_MATCH, bflush);***/
      bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      /* Insert in hash table all strings up to the end of the match.
       * strstart-1 and strstart are already inserted. If there is not
       * enough lookahead, the last two strings are not inserted in
       * the hash table.
       */
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;

      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }

    } else if (s.match_available) {
      /* If there was no match at the previous position, output a
       * single literal. If there was a match but the current match
       * is longer, truncate the previous match to a single literal.
       */
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);

      if (bflush) {
        /*** FLUSH_BLOCK_ONLY(s, 0) ***/
        flush_block_only(s, false);
        /***/
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      /* There is no previous match to compare with, wait for
       * the next step to decide.
       */
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  //Assert (flush != Z_NO_FLUSH, "no flush?");
  if (s.match_available) {
    //Tracevv((stderr,"%c", s->window[s->strstart-1]));
    /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);

    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_BLOCK_DONE;
};


/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
const deflate_rle = (s, flush) => {

  let bflush;            /* set if current block must be flushed */
  let prev;              /* byte at distance one to match */
  let scan, strend;      /* scan goes up to strend for length of run */

  const _win = s.window;

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the longest run, plus one for the unrolled loop.
     */
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* See how many times the previous byte repeats */
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
          /*jshint noempty:false*/
        } while (prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
      //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
    }

    /* Emit match if have run of MIN_MATCH or longer, else emit literal */
    if (s.match_length >= MIN_MATCH) {
      //check_match(s, s.strstart, s.strstart - 1, s.match_length);

      /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
};

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
const deflate_huff = (s, flush) => {

  let bflush;             /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we have a literal to write. */
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        break;      /* flush the current block */
      }
    }

    /* Output a literal byte */
    s.match_length = 0;
    //Tracevv((stderr,"%c", s->window[s->strstart]));
    /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
    bflush = _tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
};

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
function Config(good_length, max_lazy, nice_length, max_chain, func) {

  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}

const configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),          /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),            /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),           /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),          /* 3 */

  new Config(4, 4, 16, 16, deflate_slow),          /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),         /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),       /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),       /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),    /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)     /* 9 max compression */
];


/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
const lm_init = (s) => {

  s.window_size = 2 * s.w_size;

  /*** CLEAR_HASH(s); ***/
  zero(s.head); // Fill with NIL (= 0);

  /* Set the default configuration parameters:
   */
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;

  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
};


function DeflateState() {
  this.strm = null;            /* pointer back to this zlib stream */
  this.status = 0;            /* as the name implies */
  this.pending_buf = null;      /* output still pending */
  this.pending_buf_size = 0;  /* size of pending_buf */
  this.pending_out = 0;       /* next pending byte to output to the stream */
  this.pending = 0;           /* nb of bytes in the pending buffer */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.gzhead = null;         /* gzip header information to write */
  this.gzindex = 0;           /* where in extra, name, or comment */
  this.method = Z_DEFLATED$2; /* can only be DEFLATED */
  this.last_flush = -1;   /* value of flush param for previous deflate call */

  this.w_size = 0;  /* LZ77 window size (32K by default) */
  this.w_bits = 0;  /* log2(w_size)  (8..16) */
  this.w_mask = 0;  /* w_size - 1 */

  this.window = null;
  /* Sliding window. Input bytes are read into the second half of the window,
   * and move to the first half later to keep a dictionary of at least wSize
   * bytes. With this organization, matches are limited to a distance of
   * wSize-MAX_MATCH bytes, but this ensures that IO is always
   * performed with a length multiple of the block size.
   */

  this.window_size = 0;
  /* Actual size of window: 2*wSize, except when the user input buffer
   * is directly used as sliding window.
   */

  this.prev = null;
  /* Link to older string with same hash index. To limit the size of this
   * array to 64K, this link is maintained only for the last 32K strings.
   * An index in this array is thus a window index modulo 32K.
   */

  this.head = null;   /* Heads of the hash chains or NIL. */

  this.ins_h = 0;       /* hash index of string to be inserted */
  this.hash_size = 0;   /* number of elements in hash table */
  this.hash_bits = 0;   /* log2(hash_size) */
  this.hash_mask = 0;   /* hash_size-1 */

  this.hash_shift = 0;
  /* Number of bits by which ins_h must be shifted at each input
   * step. It must be such that after MIN_MATCH steps, the oldest
   * byte no longer takes part in the hash key, that is:
   *   hash_shift * MIN_MATCH >= hash_bits
   */

  this.block_start = 0;
  /* Window position at the beginning of the current output block. Gets
   * negative when the window is moved backwards.
   */

  this.match_length = 0;      /* length of best match */
  this.prev_match = 0;        /* previous match */
  this.match_available = 0;   /* set if previous match exists */
  this.strstart = 0;          /* start of string to insert */
  this.match_start = 0;       /* start of matching string */
  this.lookahead = 0;         /* number of valid bytes ahead in window */

  this.prev_length = 0;
  /* Length of the best match at previous step. Matches not greater than this
   * are discarded. This is used in the lazy match evaluation.
   */

  this.max_chain_length = 0;
  /* To speed up deflation, hash chains are never searched beyond this
   * length.  A higher limit improves compression ratio but degrades the
   * speed.
   */

  this.max_lazy_match = 0;
  /* Attempt to find a better match only when the current match is strictly
   * smaller than this value. This mechanism is used only for compression
   * levels >= 4.
   */
  // That's alias to max_lazy_match, don't use directly
  //this.max_insert_length = 0;
  /* Insert new strings in the hash table only if the match length is not
   * greater than this length. This saves time but degrades compression.
   * max_insert_length is used only for compression levels <= 3.
   */

  this.level = 0;     /* compression level (1..9) */
  this.strategy = 0;  /* favor or force Huffman coding*/

  this.good_match = 0;
  /* Use a faster search when the previous match is longer than this */

  this.nice_match = 0; /* Stop searching when current match exceeds this */

              /* used by trees.c: */

  /* Didn't use ct_data typedef below to suppress compiler warning */

  // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
  // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

  // Use flat array of DOUBLE size, with interleaved fata,
  // because JS does not support effective
  this.dyn_ltree  = new Uint16Array(HEAP_SIZE * 2);
  this.dyn_dtree  = new Uint16Array((2 * D_CODES + 1) * 2);
  this.bl_tree    = new Uint16Array((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);

  this.l_desc   = null;         /* desc. for literal tree */
  this.d_desc   = null;         /* desc. for distance tree */
  this.bl_desc  = null;         /* desc. for bit length tree */

  //ush bl_count[MAX_BITS+1];
  this.bl_count = new Uint16Array(MAX_BITS + 1);
  /* number of codes at each bit length for an optimal tree */

  //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
  this.heap = new Uint16Array(2 * L_CODES + 1);  /* heap used to build the Huffman trees */
  zero(this.heap);

  this.heap_len = 0;               /* number of elements in the heap */
  this.heap_max = 0;               /* element of largest frequency */
  /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
   * The same heap array is used to build all trees.
   */

  this.depth = new Uint16Array(2 * L_CODES + 1); //uch depth[2*L_CODES+1];
  zero(this.depth);
  /* Depth of each subtree used as tie breaker for trees of equal frequency
   */

  this.sym_buf = 0;        /* buffer for distances and literals/lengths */

  this.lit_bufsize = 0;
  /* Size of match buffer for literals/lengths.  There are 4 reasons for
   * limiting lit_bufsize to 64K:
   *   - frequencies can be kept in 16 bit counters
   *   - if compression is not successful for the first block, all input
   *     data is still in the window so we can still emit a stored block even
   *     when input comes from standard input.  (This can also be done for
   *     all blocks if lit_bufsize is not greater than 32K.)
   *   - if compression is not successful for a file smaller than 64K, we can
   *     even emit a stored file instead of a stored block (saving 5 bytes).
   *     This is applicable only for zip (not gzip or zlib).
   *   - creating new Huffman trees less frequently may not provide fast
   *     adaptation to changes in the input data statistics. (Take for
   *     example a binary file with poorly compressible code followed by
   *     a highly compressible string table.) Smaller buffer sizes give
   *     fast adaptation but have of course the overhead of transmitting
   *     trees more frequently.
   *   - I can't count above 4
   */

  this.sym_next = 0;      /* running index in sym_buf */
  this.sym_end = 0;       /* symbol table full when sym_next reaches this */

  this.opt_len = 0;       /* bit length of current block with optimal trees */
  this.static_len = 0;    /* bit length of current block with static trees */
  this.matches = 0;       /* number of string matches in current block */
  this.insert = 0;        /* bytes at end of window left to insert */


  this.bi_buf = 0;
  /* Output buffer. bits are inserted starting at the bottom (least
   * significant bits).
   */
  this.bi_valid = 0;
  /* Number of valid bits in bi_buf.  All bits above the last valid bit
   * are always zero.
   */

  // Used for window memory init. We safely ignore it for JS. That makes
  // sense only for pointers and memory check tools.
  //this.high_water = 0;
  /* High water mark offset in window for initialized bytes -- bytes above
   * this are set to zero in order to avoid memory check warnings when
   * longest match routines access bytes past the input.  This is then
   * updated to the new high water mark.
   */
}


/* =========================================================================
 * Check for a valid deflate stream state. Return 0 if ok, 1 if not.
 */
const deflateStateCheck = (strm) => {

  if (!strm) {
    return 1;
  }
  const s = strm.state;
  if (!s || s.strm !== strm || (s.status !== INIT_STATE &&
//#ifdef GZIP
                                s.status !== GZIP_STATE &&
//#endif
                                s.status !== EXTRA_STATE &&
                                s.status !== NAME_STATE &&
                                s.status !== COMMENT_STATE &&
                                s.status !== HCRC_STATE &&
                                s.status !== BUSY_STATE &&
                                s.status !== FINISH_STATE)) {
    return 1;
  }
  return 0;
};


const deflateResetKeep = (strm) => {

  if (deflateStateCheck(strm)) {
    return err(strm, Z_STREAM_ERROR$2);
  }

  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;

  const s = strm.state;
  s.pending = 0;
  s.pending_out = 0;

  if (s.wrap < 0) {
    s.wrap = -s.wrap;
    /* was made negative by deflate(..., Z_FINISH); */
  }
  s.status =
//#ifdef GZIP
    s.wrap === 2 ? GZIP_STATE :
//#endif
    s.wrap ? INIT_STATE : BUSY_STATE;
  strm.adler = (s.wrap === 2) ?
    0  // crc32(0, Z_NULL, 0)
  :
    1; // adler32(0, Z_NULL, 0)
  s.last_flush = -2;
  _tr_init(s);
  return Z_OK$3;
};


const deflateReset = (strm) => {

  const ret = deflateResetKeep(strm);
  if (ret === Z_OK$3) {
    lm_init(strm.state);
  }
  return ret;
};


const deflateSetHeader = (strm, head) => {

  if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
    return Z_STREAM_ERROR$2;
  }
  strm.state.gzhead = head;
  return Z_OK$3;
};


const deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {

  if (!strm) { // === Z_NULL
    return Z_STREAM_ERROR$2;
  }
  let wrap = 1;

  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6;
  }

  if (windowBits < 0) { /* suppress zlib wrapper */
    wrap = 0;
    windowBits = -windowBits;
  }

  else if (windowBits > 15) {
    wrap = 2;           /* write gzip wrapper instead */
    windowBits -= 16;
  }


  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 ||
    windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
    strategy < 0 || strategy > Z_FIXED || (windowBits === 8 && wrap !== 1)) {
    return err(strm, Z_STREAM_ERROR$2);
  }


  if (windowBits === 8) {
    windowBits = 9;
  }
  /* until 256-byte window bug fixed */

  const s = new DeflateState();

  strm.state = s;
  s.strm = strm;
  s.status = INIT_STATE;     /* to pass state test in deflateReset() */

  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;

  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

  s.window = new Uint8Array(s.w_size * 2);
  s.head = new Uint16Array(s.hash_size);
  s.prev = new Uint16Array(s.w_size);

  // Don't need mem init magic for JS.
  //s.high_water = 0;  /* nothing written to s->window yet */

  s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

  /* We overlay pending_buf and sym_buf. This works since the average size
   * for length/distance pairs over any compressed block is assured to be 31
   * bits or less.
   *
   * Analysis: The longest fixed codes are a length code of 8 bits plus 5
   * extra bits, for lengths 131 to 257. The longest fixed distance codes are
   * 5 bits plus 13 extra bits, for distances 16385 to 32768. The longest
   * possible fixed-codes length/distance pair is then 31 bits total.
   *
   * sym_buf starts one-fourth of the way into pending_buf. So there are
   * three bytes in sym_buf for every four bytes in pending_buf. Each symbol
   * in sym_buf is three bytes -- two for the distance and one for the
   * literal/length. As each symbol is consumed, the pointer to the next
   * sym_buf value to read moves forward three bytes. From that symbol, up to
   * 31 bits are written to pending_buf. The closest the written pending_buf
   * bits gets to the next sym_buf symbol to read is just before the last
   * code is written. At that time, 31*(n-2) bits have been written, just
   * after 24*(n-2) bits have been consumed from sym_buf. sym_buf starts at
   * 8*n bits into pending_buf. (Note that the symbol buffer fills when n-1
   * symbols are written.) The closest the writing gets to what is unread is
   * then n+14 bits. Here n is lit_bufsize, which is 16384 by default, and
   * can range from 128 to 32768.
   *
   * Therefore, at a minimum, there are 142 bits of space between what is
   * written and what is read in the overlain buffers, so the symbols cannot
   * be overwritten by the compressed data. That space is actually 139 bits,
   * due to the three-bit fixed-code block header.
   *
   * That covers the case where either Z_FIXED is specified, forcing fixed
   * codes, or when the use of fixed codes is chosen, because that choice
   * results in a smaller compressed block than dynamic codes. That latter
   * condition then assures that the above analysis also covers all dynamic
   * blocks. A dynamic-code block will only be chosen to be emitted if it has
   * fewer bits than a fixed-code block would for the same set of symbols.
   * Therefore its average symbol length is assured to be less than 31. So
   * the compressed data for a dynamic block also cannot overwrite the
   * symbols from which it is being constructed.
   */

  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new Uint8Array(s.pending_buf_size);

  // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
  //s->sym_buf = s->pending_buf + s->lit_bufsize;
  s.sym_buf = s.lit_bufsize;

  //s->sym_end = (s->lit_bufsize - 1) * 3;
  s.sym_end = (s.lit_bufsize - 1) * 3;
  /* We avoid equality with lit_bufsize*3 because of wraparound at 64K
   * on 16 bit machines and because stored blocks are restricted to
   * 64K-1 bytes.
   */

  s.level = level;
  s.strategy = strategy;
  s.method = method;

  return deflateReset(strm);
};

const deflateInit = (strm, level) => {

  return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
};


/* ========================================================================= */
const deflate$2 = (strm, flush) => {

  if (deflateStateCheck(strm) || flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
  }

  const s = strm.state;

  if (!strm.output ||
      (strm.avail_in !== 0 && !strm.input) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH$3)) {
    return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2);
  }

  const old_flush = s.last_flush;
  s.last_flush = flush;

  /* Flush as much pending output as possible */
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      /* Since avail_out is 0, deflate will be called again with
       * more output space, but possibly with both pending and
       * avail_in equal to zero. There won't be anything to do,
       * but this is not an error situation so make sure we
       * return OK instead of BUF_ERROR at next call of deflate:
       */
      s.last_flush = -1;
      return Z_OK$3;
    }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
    flush !== Z_FINISH$3) {
    return err(strm, Z_BUF_ERROR$1);
  }

  /* User must not provide more input after the first FINISH: */
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$1);
  }

  /* Write the header */
  if (s.status === INIT_STATE && s.wrap === 0) {
    s.status = BUSY_STATE;
  }
  if (s.status === INIT_STATE) {
    /* zlib header */
    let header = (Z_DEFLATED$2 + ((s.w_bits - 8) << 4)) << 8;
    let level_flags = -1;

    if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
      level_flags = 0;
    } else if (s.level < 6) {
      level_flags = 1;
    } else if (s.level === 6) {
      level_flags = 2;
    } else {
      level_flags = 3;
    }
    header |= (level_flags << 6);
    if (s.strstart !== 0) { header |= PRESET_DICT; }
    header += 31 - (header % 31);

    putShortMSB(s, header);

    /* Save the adler32 of the preset dictionary: */
    if (s.strstart !== 0) {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 0xffff);
    }
    strm.adler = 1; // adler32(0L, Z_NULL, 0);
    s.status = BUSY_STATE;

    /* Compression must start with an empty pending buffer */
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
//#ifdef GZIP
  if (s.status === GZIP_STATE) {
    /* gzip header */
    strm.adler = 0;  //crc32(0L, Z_NULL, 0);
    put_byte(s, 31);
    put_byte(s, 139);
    put_byte(s, 8);
    if (!s.gzhead) { // s->gzhead == Z_NULL
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, s.level === 9 ? 2 :
                  (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                   4 : 0));
      put_byte(s, OS_CODE);
      s.status = BUSY_STATE;

      /* Compression must start with an empty pending buffer */
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
    else {
      put_byte(s, (s.gzhead.text ? 1 : 0) +
                  (s.gzhead.hcrc ? 2 : 0) +
                  (!s.gzhead.extra ? 0 : 4) +
                  (!s.gzhead.name ? 0 : 8) +
                  (!s.gzhead.comment ? 0 : 16)
      );
      put_byte(s, s.gzhead.time & 0xff);
      put_byte(s, (s.gzhead.time >> 8) & 0xff);
      put_byte(s, (s.gzhead.time >> 16) & 0xff);
      put_byte(s, (s.gzhead.time >> 24) & 0xff);
      put_byte(s, s.level === 9 ? 2 :
                  (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                   4 : 0));
      put_byte(s, s.gzhead.os & 0xff);
      if (s.gzhead.extra && s.gzhead.extra.length) {
        put_byte(s, s.gzhead.extra.length & 0xff);
        put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
      }
      if (s.gzhead.hcrc) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
      }
      s.gzindex = 0;
      s.status = EXTRA_STATE;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra/* != Z_NULL*/) {
      let beg = s.pending;   /* start of bytes to update crc */
      let left = (s.gzhead.extra.length & 0xffff) - s.gzindex;
      while (s.pending + left > s.pending_buf_size) {
        let copy = s.pending_buf_size - s.pending;
        // zmemcpy(s.pending_buf + s.pending,
        //    s.gzhead.extra + s.gzindex, copy);
        s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
        s.pending = s.pending_buf_size;
        //--- HCRC_UPDATE(beg) ---//
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        //---//
        s.gzindex += copy;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
        beg = 0;
        left -= copy;
      }
      // JS specific: s.gzhead.extra may be TypedArray or Array for backward compatibility
      //              TypedArray.slice and TypedArray.from don't exist in IE10-IE11
      let gzhead_extra = new Uint8Array(s.gzhead.extra);
      // zmemcpy(s->pending_buf + s->pending,
      //     s->gzhead->extra + s->gzindex, left);
      s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
      s.pending += left;
      //--- HCRC_UPDATE(beg) ---//
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      //---//
      s.gzindex = 0;
    }
    s.status = NAME_STATE;
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name/* != Z_NULL*/) {
      let beg = s.pending;   /* start of bytes to update crc */
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          //--- HCRC_UPDATE(beg) ---//
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          //---//
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      //--- HCRC_UPDATE(beg) ---//
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      //---//
      s.gzindex = 0;
    }
    s.status = COMMENT_STATE;
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment/* != Z_NULL*/) {
      let beg = s.pending;   /* start of bytes to update crc */
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          //--- HCRC_UPDATE(beg) ---//
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          //---//
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      //--- HCRC_UPDATE(beg) ---//
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      //---//
    }
    s.status = HCRC_STATE;
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      }
      put_byte(s, strm.adler & 0xff);
      put_byte(s, (strm.adler >> 8) & 0xff);
      strm.adler = 0; //crc32(0L, Z_NULL, 0);
    }
    s.status = BUSY_STATE;

    /* Compression must start with an empty pending buffer */
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
//#endif

  /* Start a new block or continue the current one.
   */
  if (strm.avail_in !== 0 || s.lookahead !== 0 ||
    (flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE)) {
    let bstate = s.level === 0 ? deflate_stored(s, flush) :
                 s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) :
                 s.strategy === Z_RLE ? deflate_rle(s, flush) :
                 configuration_table[s.level].func(s, flush);

    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        /* avoid BUF_ERROR next call, see above */
      }
      return Z_OK$3;
      /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
       * of deflate should use the same flush parameter to make sure
       * that the flush is complete. So we don't have to output an
       * empty block here, this will be done at next call. This also
       * ensures that for a very small output buffer, we emit at most
       * one empty block.
       */
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        _tr_align(s);
      }
      else if (flush !== Z_BLOCK$1) { /* FULL_FLUSH or SYNC_FLUSH */

        _tr_stored_block(s, 0, 0, false);
        /* For a full flush, this empty block will be recognized
         * as a special marker by inflate_sync().
         */
        if (flush === Z_FULL_FLUSH$1) {
          /*** CLEAR_HASH(s); ***/             /* forget history */
          zero(s.head); // Fill with NIL (= 0);

          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
        return Z_OK$3;
      }
    }
  }

  if (flush !== Z_FINISH$3) { return Z_OK$3; }
  if (s.wrap <= 0) { return Z_STREAM_END$3; }

  /* Write the trailer */
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 0xff);
    put_byte(s, (strm.adler >> 8) & 0xff);
    put_byte(s, (strm.adler >> 16) & 0xff);
    put_byte(s, (strm.adler >> 24) & 0xff);
    put_byte(s, strm.total_in & 0xff);
    put_byte(s, (strm.total_in >> 8) & 0xff);
    put_byte(s, (strm.total_in >> 16) & 0xff);
    put_byte(s, (strm.total_in >> 24) & 0xff);
  }
  else
  {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 0xffff);
  }

  flush_pending(strm);
  /* If avail_out is zero, the application will call deflate again
   * to flush the rest.
   */
  if (s.wrap > 0) { s.wrap = -s.wrap; }
  /* write the trailer only once! */
  return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
};


const deflateEnd = (strm) => {

  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }

  const status = strm.state.status;

  strm.state = null;

  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
};


/* =========================================================================
 * Initializes the compression dictionary from the given byte
 * sequence without producing any compressed output.
 */
const deflateSetDictionary = (strm, dictionary) => {

  let dictLength = dictionary.length;

  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }

  const s = strm.state;
  const wrap = s.wrap;

  if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
    return Z_STREAM_ERROR$2;
  }

  /* when using zlib wrappers, compute Adler-32 for provided dictionary */
  if (wrap === 1) {
    /* adler32(strm->adler, dictionary, dictLength); */
    strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
  }

  s.wrap = 0;   /* avoid computing Adler-32 in read_buf */

  /* if dictionary would fill window, just replace the history */
  if (dictLength >= s.w_size) {
    if (wrap === 0) {            /* already empty otherwise */
      /*** CLEAR_HASH(s); ***/
      zero(s.head); // Fill with NIL (= 0);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    /* use the tail */
    // dictionary = dictionary.slice(dictLength - s.w_size);
    let tmpDict = new Uint8Array(s.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  /* insert dictionary into window and hash */
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH - 1);
    do {
      /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
      s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);

      s.prev[str & s.w_mask] = s.head[s.ins_h];

      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK$3;
};


var deflateInit_1 = deflateInit;
var deflateInit2_1 = deflateInit2;
var deflateReset_1 = deflateReset;
var deflateResetKeep_1 = deflateResetKeep;
var deflateSetHeader_1 = deflateSetHeader;
var deflate_2$1 = deflate$2;
var deflateEnd_1 = deflateEnd;
var deflateSetDictionary_1 = deflateSetDictionary;
var deflateInfo = 'pako deflate (from Nodeca project)';

/* Not implemented
module.exports.deflateBound = deflateBound;
module.exports.deflateCopy = deflateCopy;
module.exports.deflateGetDictionary = deflateGetDictionary;
module.exports.deflateParams = deflateParams;
module.exports.deflatePending = deflatePending;
module.exports.deflatePrime = deflatePrime;
module.exports.deflateTune = deflateTune;
*/

var deflate_1$2 = {
	deflateInit: deflateInit_1,
	deflateInit2: deflateInit2_1,
	deflateReset: deflateReset_1,
	deflateResetKeep: deflateResetKeep_1,
	deflateSetHeader: deflateSetHeader_1,
	deflate: deflate_2$1,
	deflateEnd: deflateEnd_1,
	deflateSetDictionary: deflateSetDictionary_1,
	deflateInfo: deflateInfo
};

const _has = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};

var assign = function (obj /*from1, from2, from3, ...*/) {
  const sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    const source = sources.shift();
    if (!source) { continue; }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be non-object');
    }

    for (const p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }

  return obj;
};


// Join array of chunks to single array.
var flattenChunks = (chunks) => {
  // calculate data length
  let len = 0;

  for (let i = 0, l = chunks.length; i < l; i++) {
    len += chunks[i].length;
  }

  // join chunks
  const result = new Uint8Array(len);

  for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
    let chunk = chunks[i];
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
};

var common = {
	assign: assign,
	flattenChunks: flattenChunks
};

// String encode/decode helpers


// Quick check if we can use fast array to bin string conversion
//
// - apply(Array) can fail on Android 2.2
// - apply(Uint8Array) can fail on iOS 5.1 Safari
//
let STR_APPLY_UIA_OK = true;

try { String.fromCharCode.apply(null, new Uint8Array(1)); } catch (__) { STR_APPLY_UIA_OK = false; }


// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
const _utf8len = new Uint8Array(256);
for (let q = 0; q < 256; q++) {
  _utf8len[q] = (q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1);
}
_utf8len[254] = _utf8len[254] = 1; // Invalid sequence start


// convert string to array (typed, when possible)
var string2buf = (str) => {
  if (typeof TextEncoder === 'function' && TextEncoder.prototype.encode) {
    return new TextEncoder().encode(str);
  }

  let buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;

  // count binary size
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }

  // allocate buffer
  buf = new Uint8Array(buf_len);

  // convert
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    if (c < 0x80) {
      /* one byte */
      buf[i++] = c;
    } else if (c < 0x800) {
      /* two bytes */
      buf[i++] = 0xC0 | (c >>> 6);
      buf[i++] = 0x80 | (c & 0x3f);
    } else if (c < 0x10000) {
      /* three bytes */
      buf[i++] = 0xE0 | (c >>> 12);
      buf[i++] = 0x80 | (c >>> 6 & 0x3f);
      buf[i++] = 0x80 | (c & 0x3f);
    } else {
      /* four bytes */
      buf[i++] = 0xf0 | (c >>> 18);
      buf[i++] = 0x80 | (c >>> 12 & 0x3f);
      buf[i++] = 0x80 | (c >>> 6 & 0x3f);
      buf[i++] = 0x80 | (c & 0x3f);
    }
  }

  return buf;
};

// Helper
const buf2binstring = (buf, len) => {
  // On Chrome, the arguments in a function call that are allowed is `65534`.
  // If the length of the buffer is smaller than that, we can use this optimization,
  // otherwise we will take a slower path.
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK) {
      return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
    }
  }

  let result = '';
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
};


// convert array to string
var buf2string = (buf, max) => {
  const len = max || buf.length;

  if (typeof TextDecoder === 'function' && TextDecoder.prototype.decode) {
    return new TextDecoder().decode(buf.subarray(0, max));
  }

  let i, out;

  // Reserve max possible length (2 words per char)
  // NB: by unknown reasons, Array is significantly faster for
  //     String.fromCharCode.apply than Uint16Array.
  const utf16buf = new Array(len * 2);

  for (out = 0, i = 0; i < len;) {
    let c = buf[i++];
    // quick process ascii
    if (c < 0x80) { utf16buf[out++] = c; continue; }

    let c_len = _utf8len[c];
    // skip 5 & 6 byte codes
    if (c_len > 4) { utf16buf[out++] = 0xfffd; i += c_len - 1; continue; }

    // apply mask on first byte
    c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
    // join the rest
    while (c_len > 1 && i < len) {
      c = (c << 6) | (buf[i++] & 0x3f);
      c_len--;
    }

    // terminated by end of string?
    if (c_len > 1) { utf16buf[out++] = 0xfffd; continue; }

    if (c < 0x10000) {
      utf16buf[out++] = c;
    } else {
      c -= 0x10000;
      utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff);
      utf16buf[out++] = 0xdc00 | (c & 0x3ff);
    }
  }

  return buf2binstring(utf16buf, out);
};


// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
var utf8border = (buf, max) => {

  max = max || buf.length;
  if (max > buf.length) { max = buf.length; }

  // go back from last position, until start of sequence found
  let pos = max - 1;
  while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) { pos--; }

  // Very small and broken sequence,
  // return max, because we should return something anyway.
  if (pos < 0) { return max; }

  // If we came to start of buffer - that means buffer is too small,
  // return max too.
  if (pos === 0) { return max; }

  return (pos + _utf8len[buf[pos]] > max) ? pos : max;
};

var strings = {
	string2buf: string2buf,
	buf2string: buf2string,
	utf8border: utf8border
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function ZStream() {
  /* next input byte */
  this.input = null; // JS specific, because we have no pointers
  this.next_in = 0;
  /* number of bytes available at input */
  this.avail_in = 0;
  /* total number of input bytes read so far */
  this.total_in = 0;
  /* next output byte should be put there */
  this.output = null; // JS specific, because we have no pointers
  this.next_out = 0;
  /* remaining free space at output */
  this.avail_out = 0;
  /* total number of bytes output so far */
  this.total_out = 0;
  /* last error message, NULL if no error */
  this.msg = ''/*Z_NULL*/;
  /* not visible by applications */
  this.state = null;
  /* best guess about the data type: binary or text */
  this.data_type = 2/*Z_UNKNOWN*/;
  /* adler32 value of the uncompressed data */
  this.adler = 0;
}

var zstream = ZStream;

const toString$1 = Object.prototype.toString;

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH: Z_NO_FLUSH$1, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH: Z_FINISH$2,
  Z_OK: Z_OK$2, Z_STREAM_END: Z_STREAM_END$2,
  Z_DEFAULT_COMPRESSION,
  Z_DEFAULT_STRATEGY,
  Z_DEFLATED: Z_DEFLATED$1
} = constants$2;

/* ===========================================================================*/


/**
 * class Deflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[deflate]],
 * [[deflateRaw]] and [[gzip]].
 **/

/* internal
 * Deflate.chunks -> Array
 *
 * Chunks of output data, if [[Deflate#onData]] not overridden.
 **/

/**
 * Deflate.result -> Uint8Array
 *
 * Compressed result, generated by default [[Deflate#onData]]
 * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Deflate#push]] with `Z_FINISH` / `true` param).
 **/

/**
 * Deflate.err -> Number
 *
 * Error code after deflate finished. 0 (Z_OK) on success.
 * You will not need it in real life, because deflate errors
 * are possible only on wrong options or bad `onData` / `onEnd`
 * custom handlers.
 **/

/**
 * Deflate.msg -> String
 *
 * Error message, if [[Deflate.err]] != 0
 **/


/**
 * new Deflate(options)
 * - options (Object): zlib deflate options.
 *
 * Creates new deflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `level`
 * - `windowBits`
 * - `memLevel`
 * - `strategy`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw deflate
 * - `gzip` (Boolean) - create gzip wrapper
 * - `header` (Object) - custom header for gzip
 *   - `text` (Boolean) - true if compressed data believed to be text
 *   - `time` (Number) - modification time, unix timestamp
 *   - `os` (Number) - operation system code
 *   - `extra` (Array) - array of bytes with extra data (max 65536)
 *   - `name` (String) - file name (binary string)
 *   - `comment` (String) - comment (binary string)
 *   - `hcrc` (Boolean) - true if header crc should be added
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 *   , chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * const deflate = new pako.Deflate({ level: 3});
 *
 * deflate.push(chunk1, false);
 * deflate.push(chunk2, true);  // true -> last chunk
 *
 * if (deflate.err) { throw new Error(deflate.err); }
 *
 * console.log(deflate.result);
 * ```
 **/
function Deflate$1(options) {
  this.options = common.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED$1,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY
  }, options || {});

  let opt = this.options;

  if (opt.raw && (opt.windowBits > 0)) {
    opt.windowBits = -opt.windowBits;
  }

  else if (opt.gzip && (opt.windowBits > 0) && (opt.windowBits < 16)) {
    opt.windowBits += 16;
  }

  this.err    = 0;      // error code, if happens (0 = Z_OK)
  this.msg    = '';     // error message
  this.ended  = false;  // used to avoid multiple onEnd() calls
  this.chunks = [];     // chunks of compressed data

  this.strm = new zstream();
  this.strm.avail_out = 0;

  let status = deflate_1$2.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );

  if (status !== Z_OK$2) {
    throw new Error(messages[status]);
  }

  if (opt.header) {
    deflate_1$2.deflateSetHeader(this.strm, opt.header);
  }

  if (opt.dictionary) {
    let dict;
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      // If we need to compress text, change encoding to utf8.
      dict = strings.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === '[object ArrayBuffer]') {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }

    status = deflate_1$2.deflateSetDictionary(this.strm, dict);

    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }

    this._dict_set = true;
  }
}

/**
 * Deflate#push(data[, flush_mode]) -> Boolean
 * - data (Uint8Array|ArrayBuffer|String): input data. Strings will be
 *   converted to utf8 byte sequence.
 * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
 *
 * Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
 * new compressed chunks. Returns `true` on success. The last data block must
 * have `flush_mode` Z_FINISH (or `true`). That will flush internal pending
 * buffers and call [[Deflate#onEnd]].
 *
 * On fail call [[Deflate#onEnd]] with error code and return false.
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Deflate$1.prototype.push = function (data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  let status, _flush_mode;

  if (this.ended) { return false; }

  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;

  // Convert data if needed
  if (typeof data === 'string') {
    // If we need to compress text, change encoding to utf8.
    strm.input = strings.string2buf(data);
  } else if (toString$1.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  for (;;) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }

    // Make sure avail_out > 6 to avoid repeating markers
    if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }

    status = deflate_1$2.deflate(strm, _flush_mode);

    // Ended => flush and finish
    if (status === Z_STREAM_END$2) {
      if (strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
      }
      status = deflate_1$2.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK$2;
    }

    // Flush if out buffer full
    if (strm.avail_out === 0) {
      this.onData(strm.output);
      continue;
    }

    // Flush if requested and has data
    if (_flush_mode > 0 && strm.next_out > 0) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }

    if (strm.avail_in === 0) break;
  }

  return true;
};


/**
 * Deflate#onData(chunk) -> Void
 * - chunk (Uint8Array): output data.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Deflate$1.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};


/**
 * Deflate#onEnd(status) -> Void
 * - status (Number): deflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called once after you tell deflate that the input stream is
 * complete (Z_FINISH). By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Deflate$1.prototype.onEnd = function (status) {
  // On success - join
  if (status === Z_OK$2) {
    this.result = common.flattenChunks(this.chunks);
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};


/**
 * deflate(data[, options]) -> Uint8Array
 * - data (Uint8Array|ArrayBuffer|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * Compress `data` with deflate algorithm and `options`.
 *
 * Supported options are:
 *
 * - level
 * - windowBits
 * - memLevel
 * - strategy
 * - dictionary
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 * const data = new Uint8Array([1,2,3,4,5,6,7,8,9]);
 *
 * console.log(pako.deflate(data));
 * ```
 **/
function deflate$1(input, options) {
  const deflator = new Deflate$1(options);

  deflator.push(input, true);

  // That will never happens, if you don't cheat with options :)
  if (deflator.err) { throw deflator.msg || messages[deflator.err]; }

  return deflator.result;
}


/**
 * deflateRaw(data[, options]) -> Uint8Array
 * - data (Uint8Array|ArrayBuffer|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function deflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return deflate$1(input, options);
}


/**
 * gzip(data[, options]) -> Uint8Array
 * - data (Uint8Array|ArrayBuffer|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but create gzip wrapper instead of
 * deflate one.
 **/
function gzip$1(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate$1(input, options);
}


var Deflate_1$1 = Deflate$1;
var deflate_2 = deflate$1;
var deflateRaw_1$1 = deflateRaw$1;
var gzip_1$1 = gzip$1;

var deflate_1$1 = {
	Deflate: Deflate_1$1,
	deflate: deflate_2,
	deflateRaw: deflateRaw_1$1,
	gzip: gzip_1$1};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// See state defs from inflate.js
const BAD$1 = 16209;       /* got a data error -- remain here until reset */
const TYPE$1 = 16191;      /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
var inffast = function inflate_fast(strm, start) {
  let _in;                    /* local strm.input */
  let last;                   /* have enough input while in < last */
  let _out;                   /* local strm.output */
  let beg;                    /* inflate()'s initial strm.output */
  let end;                    /* while out < end, enough space available */
//#ifdef INFLATE_STRICT
  let dmax;                   /* maximum distance from zlib header */
//#endif
  let wsize;                  /* window size or zero if not using window */
  let whave;                  /* valid bytes in the window */
  let wnext;                  /* window write index */
  // Use `s_window` instead `window`, avoid conflict with instrumentation tools
  let s_window;               /* allocated sliding window, if wsize != 0 */
  let hold;                   /* local strm.hold */
  let bits;                   /* local strm.bits */
  let lcode;                  /* local strm.lencode */
  let dcode;                  /* local strm.distcode */
  let lmask;                  /* mask for first level of length codes */
  let dmask;                  /* mask for first level of distance codes */
  let here;                   /* retrieved table entry */
  let op;                     /* code bits, operation, extra bits, or */
                              /*  window position, window bytes to copy */
  let len;                    /* match length, unused bytes */
  let dist;                   /* match distance */
  let from;                   /* where to copy match from */
  let from_source;


  let input, output; // JS specific, because we have no pointers

  /* copy state to local variables */
  const state = strm.state;
  //here = state.here;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
//#ifdef INFLATE_STRICT
  dmax = state.dmax;
//#endif
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;


  /* decode literals and length/distances until end-of-block or not enough
     input data or output space */

  top:
  do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }

    here = lcode[hold & lmask];

    dolen:
    for (;;) { // Goto emulation
      op = here >>> 24/*here.bits*/;
      hold >>>= op;
      bits -= op;
      op = (here >>> 16) & 0xff/*here.op*/;
      if (op === 0) {                          /* literal */
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        output[_out++] = here & 0xffff/*here.val*/;
      }
      else if (op & 16) {                     /* length base */
        len = here & 0xffff/*here.val*/;
        op &= 15;                           /* number of extra bits */
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & ((1 << op) - 1);
          hold >>>= op;
          bits -= op;
        }
        //Tracevv((stderr, "inflate:         length %u\n", len));
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];

        dodist:
        for (;;) { // goto emulation
          op = here >>> 24/*here.bits*/;
          hold >>>= op;
          bits -= op;
          op = (here >>> 16) & 0xff/*here.op*/;

          if (op & 16) {                      /* distance base */
            dist = here & 0xffff/*here.val*/;
            op &= 15;                       /* number of extra bits */
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & ((1 << op) - 1);
//#ifdef INFLATE_STRICT
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD$1;
              break top;
            }
//#endif
            hold >>>= op;
            bits -= op;
            //Tracevv((stderr, "inflate:         distance %u\n", dist));
            op = _out - beg;                /* max distance in output */
            if (dist > op) {                /* see if copy from window */
              op = dist - op;               /* distance back in window */
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back';
                  state.mode = BAD$1;
                  break top;
                }

// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//                if (len <= op - whave) {
//                  do {
//                    output[_out++] = 0;
//                  } while (--len);
//                  continue top;
//                }
//                len -= op - whave;
//                do {
//                  output[_out++] = 0;
//                } while (--op > whave);
//                if (op === 0) {
//                  from = _out - dist;
//                  do {
//                    output[_out++] = output[from++];
//                  } while (--len);
//                  continue top;
//                }
//#endif
              }
              from = 0; // window index
              from_source = s_window;
              if (wnext === 0) {           /* very common case */
                from += wsize - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              else if (wnext < op) {      /* wrap around window */
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {         /* some from end of window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = 0;
                  if (wnext < len) {  /* some from start of window */
                    op = wnext;
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;      /* rest from output */
                    from_source = output;
                  }
                }
              }
              else {                      /* contiguous in window */
                from += wnext - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) {
                  output[_out++] = from_source[from++];
                }
              }
            }
            else {
              from = _out - dist;          /* copy direct from output */
              do {                        /* minimum length is three */
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) {
                  output[_out++] = output[from++];
                }
              }
            }
          }
          else if ((op & 64) === 0) {          /* 2nd level distance code */
            here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
            continue dodist;
          }
          else {
            strm.msg = 'invalid distance code';
            state.mode = BAD$1;
            break top;
          }

          break; // need to emulate goto via "continue"
        }
      }
      else if ((op & 64) === 0) {              /* 2nd level length code */
        here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
        continue dolen;
      }
      else if (op & 32) {                     /* end-of-block */
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.mode = TYPE$1;
        break top;
      }
      else {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD$1;
        break top;
      }

      break; // need to emulate goto via "continue"
    }
  } while (_in < last && _out < end);

  /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;

  /* update state and return */
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
  strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
  state.hold = hold;
  state.bits = bits;
  return;
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const MAXBITS = 15;
const ENOUGH_LENS$1 = 852;
const ENOUGH_DISTS$1 = 592;
//const ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

const CODES$1 = 0;
const LENS$1 = 1;
const DISTS$1 = 2;

const lbase = new Uint16Array([ /* Length codes 257..285 base */
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
]);

const lext = new Uint8Array([ /* Length codes 257..285 extra */
  16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
  19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
]);

const dbase = new Uint16Array([ /* Distance codes 0..29 base */
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577, 0, 0
]);

const dext = new Uint8Array([ /* Distance codes 0..29 extra */
  16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
  23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
  28, 28, 29, 29, 64, 64
]);

const inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) =>
{
  const bits = opts.bits;
      //here = opts.here; /* table entry for duplication */

  let len = 0;               /* a code's length in bits */
  let sym = 0;               /* index of code symbols */
  let min = 0, max = 0;          /* minimum and maximum code lengths */
  let root = 0;              /* number of index bits for root table */
  let curr = 0;              /* number of index bits for current table */
  let drop = 0;              /* code bits to drop for sub-table */
  let left = 0;                   /* number of prefix codes available */
  let used = 0;              /* code entries in table used */
  let huff = 0;              /* Huffman code */
  let incr;              /* for incrementing code, index */
  let fill;              /* index for replicating entries */
  let low;               /* low bits for current root entry */
  let mask;              /* mask for low root bits */
  let next;             /* next available space in table */
  let base = null;     /* base value table to use */
//  let shoextra;    /* extra bits table to use */
  let match;                  /* use base and extra for symbol >= match */
  const count = new Uint16Array(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
  const offs = new Uint16Array(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
  let extra = null;

  let here_bits, here_op, here_val;

  /*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.

   This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.

   The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.

   The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

  /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }

  /* bound code lengths, force root to be within code lengths */
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) { break; }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {                     /* no symbols to code at all */
    //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
    //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
    //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;


    //table.op[opts.table_index] = 64;
    //table.bits[opts.table_index] = 1;
    //table.val[opts.table_index++] = 0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;

    opts.bits = 1;
    return 0;     /* no symbols, but wait for decoding to report error */
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) { break; }
  }
  if (root < min) {
    root = min;
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }        /* over-subscribed */
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) {
    return -1;                      /* incomplete set */
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }

  /* sort symbols by length, by symbol order within each length */
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }

  /*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.

   root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.

   When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.

   used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.

   sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

  /* set up for code type */
  // poor man optimization - use if-else instead of switch,
  // to avoid deopts in old v8
  if (type === CODES$1) {
    base = extra = work;    /* dummy value--not used */
    match = 20;

  } else if (type === LENS$1) {
    base = lbase;
    extra = lext;
    match = 257;

  } else {                    /* DISTS */
    base = dbase;
    extra = dext;
    match = 0;
  }

  /* initialize opts for loop */
  huff = 0;                   /* starting code */
  sym = 0;                    /* starting code symbol */
  len = min;                  /* starting code length */
  next = table_index;              /* current table to fill in */
  curr = root;                /* current table index bits */
  drop = 0;                   /* current bits to drop from code for index */
  low = -1;                   /* trigger new sub-table when len > root */
  used = 1 << root;          /* use root table entries */
  mask = used - 1;            /* mask for comparing low */

  /* check available table space */
  if ((type === LENS$1 && used > ENOUGH_LENS$1) ||
    (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
    return 1;
  }

  /* process all codes and make table entries */
  for (;;) {
    /* create table entry */
    here_bits = len - drop;
    if (work[sym] + 1 < match) {
      here_op = 0;
      here_val = work[sym];
    }
    else if (work[sym] >= match) {
      here_op = extra[work[sym] - match];
      here_val = base[work[sym] - match];
    }
    else {
      here_op = 32 + 64;         /* end of block */
      here_val = 0;
    }

    /* replicate for those indices with low len bits equal to huff */
    incr = 1 << (len - drop);
    fill = 1 << curr;
    min = fill;                 /* save offset to next table */
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val |0;
    } while (fill !== 0);

    /* backwards increment the len-bit code huff */
    incr = 1 << (len - 1);
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }

    /* go to next symbol, update count, len */
    sym++;
    if (--count[len] === 0) {
      if (len === max) { break; }
      len = lens[lens_index + work[sym]];
    }

    /* create new sub-table if needed */
    if (len > root && (huff & mask) !== low) {
      /* if first time, transition to sub-tables */
      if (drop === 0) {
        drop = root;
      }

      /* increment past last table */
      next += min;            /* here min is 1 << curr */

      /* determine length of next table */
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) { break; }
        curr++;
        left <<= 1;
      }

      /* check for enough space */
      used += 1 << curr;
      if ((type === LENS$1 && used > ENOUGH_LENS$1) ||
        (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
        return 1;
      }

      /* point entry in root table to sub-table */
      low = huff & mask;
      /*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
      table[low] = (root << 24) | (curr << 16) | (next - table_index) |0;
    }
  }

  /* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
  if (huff !== 0) {
    //table.op[next + huff] = 64;            /* invalid code marker */
    //table.bits[next + huff] = len - drop;
    //table.val[next + huff] = 0;
    table[next + huff] = ((len - drop) << 24) | (64 << 16) |0;
  }

  /* set return parameters */
  //opts.table_index += used;
  opts.bits = root;
  return 0;
};


var inftrees = inflate_table;

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.






const CODES = 0;
const LENS = 1;
const DISTS = 2;

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_FINISH: Z_FINISH$1, Z_BLOCK, Z_TREES,
  Z_OK: Z_OK$1, Z_STREAM_END: Z_STREAM_END$1, Z_NEED_DICT: Z_NEED_DICT$1, Z_STREAM_ERROR: Z_STREAM_ERROR$1, Z_DATA_ERROR: Z_DATA_ERROR$1, Z_MEM_ERROR: Z_MEM_ERROR$1, Z_BUF_ERROR,
  Z_DEFLATED
} = constants$2;


/* STATES ====================================================================*/
/* ===========================================================================*/


const    HEAD = 16180;       /* i: waiting for magic header */
const    FLAGS = 16181;      /* i: waiting for method and flags (gzip) */
const    TIME = 16182;       /* i: waiting for modification time (gzip) */
const    OS = 16183;         /* i: waiting for extra flags and operating system (gzip) */
const    EXLEN = 16184;      /* i: waiting for extra length (gzip) */
const    EXTRA = 16185;      /* i: waiting for extra bytes (gzip) */
const    NAME = 16186;       /* i: waiting for end of file name (gzip) */
const    COMMENT = 16187;    /* i: waiting for end of comment (gzip) */
const    HCRC = 16188;       /* i: waiting for header crc (gzip) */
const    DICTID = 16189;    /* i: waiting for dictionary check value */
const    DICT = 16190;      /* waiting for inflateSetDictionary() call */
const        TYPE = 16191;      /* i: waiting for type bits, including last-flag bit */
const        TYPEDO = 16192;    /* i: same, but skip check to exit inflate on new block */
const        STORED = 16193;    /* i: waiting for stored size (length and complement) */
const        COPY_ = 16194;     /* i/o: same as COPY below, but only first time in */
const        COPY = 16195;      /* i/o: waiting for input or output to copy stored block */
const        TABLE = 16196;     /* i: waiting for dynamic block table lengths */
const        LENLENS = 16197;   /* i: waiting for code length code lengths */
const        CODELENS = 16198;  /* i: waiting for length/lit and distance code lengths */
const            LEN_ = 16199;      /* i: same as LEN below, but only first time in */
const            LEN = 16200;       /* i: waiting for length/lit/eob code */
const            LENEXT = 16201;    /* i: waiting for length extra bits */
const            DIST = 16202;      /* i: waiting for distance code */
const            DISTEXT = 16203;   /* i: waiting for distance extra bits */
const            MATCH = 16204;     /* o: waiting for output space to copy string */
const            LIT = 16205;       /* o: waiting for output space to write literal */
const    CHECK = 16206;     /* i: waiting for 32-bit check value */
const    LENGTH = 16207;    /* i: waiting for 32-bit length (gzip) */
const    DONE = 16208;      /* finished check, done -- remain here until reset */
const    BAD = 16209;       /* got a data error -- remain here until reset */
const    MEM = 16210;       /* got an inflate() memory error -- remain here until reset */
const    SYNC = 16211;      /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/



const ENOUGH_LENS = 852;
const ENOUGH_DISTS = 592;
//const ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

const MAX_WBITS = 15;
/* 32K LZ77 window */
const DEF_WBITS = MAX_WBITS;


const zswap32 = (q) => {

  return  (((q >>> 24) & 0xff) +
          ((q >>> 8) & 0xff00) +
          ((q & 0xff00) << 8) +
          ((q & 0xff) << 24));
};


function InflateState() {
  this.strm = null;           /* pointer back to this zlib stream */
  this.mode = 0;              /* current inflate mode */
  this.last = false;          /* true if processing last block */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip,
                                 bit 2 true to validate check value */
  this.havedict = false;      /* true if dictionary provided */
  this.flags = 0;             /* gzip header method and flags (0 if zlib), or
                                 -1 if raw or no header yet */
  this.dmax = 0;              /* zlib header max distance (INFLATE_STRICT) */
  this.check = 0;             /* protected copy of check value */
  this.total = 0;             /* protected copy of output count */
  // TODO: may be {}
  this.head = null;           /* where to save gzip header information */

  /* sliding window */
  this.wbits = 0;             /* log base 2 of requested window size */
  this.wsize = 0;             /* window size or zero if not using window */
  this.whave = 0;             /* valid bytes in the window */
  this.wnext = 0;             /* window write index */
  this.window = null;         /* allocated sliding window, if needed */

  /* bit accumulator */
  this.hold = 0;              /* input bit accumulator */
  this.bits = 0;              /* number of bits in "in" */

  /* for string and stored block copying */
  this.length = 0;            /* literal or length of data to copy */
  this.offset = 0;            /* distance back to copy string from */

  /* for table and code decoding */
  this.extra = 0;             /* extra bits needed */

  /* fixed and dynamic code tables */
  this.lencode = null;          /* starting table for length/literal codes */
  this.distcode = null;         /* starting table for distance codes */
  this.lenbits = 0;           /* index bits for lencode */
  this.distbits = 0;          /* index bits for distcode */

  /* dynamic table building */
  this.ncode = 0;             /* number of code length code lengths */
  this.nlen = 0;              /* number of length code lengths */
  this.ndist = 0;             /* number of distance code lengths */
  this.have = 0;              /* number of code lengths in lens[] */
  this.next = null;              /* next available space in codes[] */

  this.lens = new Uint16Array(320); /* temporary storage for code lengths */
  this.work = new Uint16Array(288); /* work area for code table building */

  /*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
  //this.codes = new Int32Array(ENOUGH);       /* space for code tables */
  this.lendyn = null;              /* dynamic table for length/literal codes (JS specific) */
  this.distdyn = null;             /* dynamic table for distance codes (JS specific) */
  this.sane = 0;                   /* if false, allow invalid distance too far */
  this.back = 0;                   /* bits back of last unprocessed length/lit */
  this.was = 0;                    /* initial length of match */
}


const inflateStateCheck = (strm) => {

  if (!strm) {
    return 1;
  }
  const state = strm.state;
  if (!state || state.strm !== strm ||
    state.mode < HEAD || state.mode > SYNC) {
    return 1;
  }
  return 0;
};


const inflateResetKeep = (strm) => {

  if (inflateStateCheck(strm)) { return Z_STREAM_ERROR$1; }
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = ''; /*Z_NULL*/
  if (state.wrap) {       /* to support ill-conceived Java test suite */
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.flags = -1;
  state.dmax = 32768;
  state.head = null/*Z_NULL*/;
  state.hold = 0;
  state.bits = 0;
  //state.lencode = state.distcode = state.next = state.codes;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);

  state.sane = 1;
  state.back = -1;
  //Tracev((stderr, "inflate: reset\n"));
  return Z_OK$1;
};


const inflateReset = (strm) => {

  if (inflateStateCheck(strm)) { return Z_STREAM_ERROR$1; }
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);

};


const inflateReset2 = (strm, windowBits) => {
  let wrap;

  /* get the state */
  if (inflateStateCheck(strm)) { return Z_STREAM_ERROR$1; }
  const state = strm.state;

  /* extract wrap request from windowBits parameter */
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  }
  else {
    wrap = (windowBits >> 4) + 5;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }

  /* set number of window bits, free window if different */
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR$1;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }

  /* update state and reset the rest of it */
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
};


const inflateInit2 = (strm, windowBits) => {

  if (!strm) { return Z_STREAM_ERROR$1; }
  //strm.msg = Z_NULL;                 /* in case we return an error */

  const state = new InflateState();

  //if (state === Z_NULL) return Z_MEM_ERROR;
  //Tracev((stderr, "inflate: allocated\n"));
  strm.state = state;
  state.strm = strm;
  state.window = null/*Z_NULL*/;
  state.mode = HEAD;     /* to pass state test in inflateReset2() */
  const ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK$1) {
    strm.state = null/*Z_NULL*/;
  }
  return ret;
};


const inflateInit = (strm) => {

  return inflateInit2(strm, DEF_WBITS);
};


/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
let virgin = true;

let lenfix, distfix; // We have no pointers in JS, so keep tables separate


const fixedtables = (state) => {

  /* build fixed huffman tables if first call (may not be thread safe) */
  if (virgin) {
    lenfix = new Int32Array(512);
    distfix = new Int32Array(32);

    /* literal/length table */
    let sym = 0;
    while (sym < 144) { state.lens[sym++] = 8; }
    while (sym < 256) { state.lens[sym++] = 9; }
    while (sym < 280) { state.lens[sym++] = 7; }
    while (sym < 288) { state.lens[sym++] = 8; }

    inftrees(LENS,  state.lens, 0, 288, lenfix,   0, state.work, { bits: 9 });

    /* distance table */
    sym = 0;
    while (sym < 32) { state.lens[sym++] = 5; }

    inftrees(DISTS, state.lens, 0, 32,   distfix, 0, state.work, { bits: 5 });

    /* do this just once */
    virgin = false;
  }

  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
};


/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
const updatewindow = (strm, src, end, copy) => {

  let dist;
  const state = strm.state;

  /* if it hasn't been done already, allocate space for the window */
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;

    state.window = new Uint8Array(state.wsize);
  }

  /* copy state->wsize or less output bytes into the circular window */
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0);
    state.wnext = 0;
    state.whave = state.wsize;
  }
  else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    //zmemcpy(state->window + state->wnext, end - copy, dist);
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
    copy -= dist;
    if (copy) {
      //zmemcpy(state->window, end - copy, copy);
      state.window.set(src.subarray(end - copy, end), 0);
      state.wnext = copy;
      state.whave = state.wsize;
    }
    else {
      state.wnext += dist;
      if (state.wnext === state.wsize) { state.wnext = 0; }
      if (state.whave < state.wsize) { state.whave += dist; }
    }
  }
  return 0;
};


const inflate$2 = (strm, flush) => {

  let state;
  let input, output;          // input/output buffers
  let next;                   /* next input INDEX */
  let put;                    /* next output INDEX */
  let have, left;             /* available input and output */
  let hold;                   /* bit buffer */
  let bits;                   /* bits in bit buffer */
  let _in, _out;              /* save starting available input and output */
  let copy;                   /* number of stored or match bytes to copy */
  let from;                   /* where to copy match bytes from */
  let from_source;
  let here = 0;               /* current decoding table entry */
  let here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
  //let last;                   /* parent table entry */
  let last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
  let len;                    /* length to copy for repeats, bits to drop */
  let ret;                    /* return code */
  const hbuf = new Uint8Array(4);    /* buffer for gzip header crc calculation */
  let opts;

  let n; // temporary variable for NEED_BITS

  const order = /* permutation of code lengths */
    new Uint8Array([ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ]);


  if (inflateStateCheck(strm) || !strm.output ||
      (!strm.input && strm.avail_in !== 0)) {
    return Z_STREAM_ERROR$1;
  }

  state = strm.state;
  if (state.mode === TYPE) { state.mode = TYPEDO; }    /* skip check */


  //--- LOAD() ---
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  //---

  _in = have;
  _out = left;
  ret = Z_OK$1;

  inf_leave: // goto emulation
  for (;;) {
    switch (state.mode) {
      case HEAD:
        if (state.wrap === 0) {
          state.mode = TYPEDO;
          break;
        }
        //=== NEEDBITS(16);
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((state.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
          if (state.wbits === 0) {
            state.wbits = 15;
          }
          state.check = 0/*crc32(0L, Z_NULL, 0)*/;
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32_1(state.check, hbuf, 2, 0);
          //===//

          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = FLAGS;
          break;
        }
        if (state.head) {
          state.head.done = false;
        }
        if (!(state.wrap & 1) ||   /* check if zlib header allowed */
          (((hold & 0xff)/*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
          strm.msg = 'incorrect header check';
          state.mode = BAD;
          break;
        }
        if ((hold & 0x0f)/*BITS(4)*/ !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
        len = (hold & 0x0f)/*BITS(4)*/ + 8;
        if (state.wbits === 0) {
          state.wbits = len;
        }
        if (len > 15 || len > state.wbits) {
          strm.msg = 'invalid window size';
          state.mode = BAD;
          break;
        }

        // !!! pako patch. Force use `options.windowBits` if passed.
        // Required to always use max window size by default.
        state.dmax = 1 << state.wbits;
        //state.dmax = 1 << len;

        state.flags = 0;               /* indicate zlib header */
        //Tracev((stderr, "inflate:   zlib header ok\n"));
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = hold & 0x200 ? DICTID : TYPE;
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        break;
      case FLAGS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.flags = hold;
        if ((state.flags & 0xff) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        if (state.flags & 0xe000) {
          strm.msg = 'unknown header flags set';
          state.mode = BAD;
          break;
        }
        if (state.head) {
          state.head.text = ((hold >> 8) & 1);
        }
        if ((state.flags & 0x0200) && (state.wrap & 4)) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32_1(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = TIME;
        /* falls through */
      case TIME:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.time = hold;
        }
        if ((state.flags & 0x0200) && (state.wrap & 4)) {
          //=== CRC4(state.check, hold)
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          hbuf[2] = (hold >>> 16) & 0xff;
          hbuf[3] = (hold >>> 24) & 0xff;
          state.check = crc32_1(state.check, hbuf, 4, 0);
          //===
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = OS;
        /* falls through */
      case OS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.xflags = (hold & 0xff);
          state.head.os = (hold >> 8);
        }
        if ((state.flags & 0x0200) && (state.wrap & 4)) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32_1(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = EXLEN;
        /* falls through */
      case EXLEN:
        if (state.flags & 0x0400) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length = hold;
          if (state.head) {
            state.head.extra_len = hold;
          }
          if ((state.flags & 0x0200) && (state.wrap & 4)) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32_1(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        else if (state.head) {
          state.head.extra = null/*Z_NULL*/;
        }
        state.mode = EXTRA;
        /* falls through */
      case EXTRA:
        if (state.flags & 0x0400) {
          copy = state.length;
          if (copy > have) { copy = have; }
          if (copy) {
            if (state.head) {
              len = state.head.extra_len - state.length;
              if (!state.head.extra) {
                // Use untyped array for more convenient processing later
                state.head.extra = new Uint8Array(state.head.extra_len);
              }
              state.head.extra.set(
                input.subarray(
                  next,
                  // extra field is limited to 65536 bytes
                  // - no need for additional size check
                  next + copy
                ),
                /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                len
              );
              //zmemcpy(state.head.extra + len, next,
              //        len + copy > state.head.extra_max ?
              //        state.head.extra_max - len : copy);
            }
            if ((state.flags & 0x0200) && (state.wrap & 4)) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            state.length -= copy;
          }
          if (state.length) { break inf_leave; }
        }
        state.length = 0;
        state.mode = NAME;
        /* falls through */
      case NAME:
        if (state.flags & 0x0800) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            // TODO: 2 or 1 bytes?
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len &&
                (state.length < 65536 /*state.head.name_max*/)) {
              state.head.name += String.fromCharCode(len);
            }
          } while (len && copy < have);

          if ((state.flags & 0x0200) && (state.wrap & 4)) {
            state.check = crc32_1(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.name = null;
        }
        state.length = 0;
        state.mode = COMMENT;
        /* falls through */
      case COMMENT:
        if (state.flags & 0x1000) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len &&
                (state.length < 65536 /*state.head.comm_max*/)) {
              state.head.comment += String.fromCharCode(len);
            }
          } while (len && copy < have);
          if ((state.flags & 0x0200) && (state.wrap & 4)) {
            state.check = crc32_1(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.comment = null;
        }
        state.mode = HCRC;
        /* falls through */
      case HCRC:
        if (state.flags & 0x0200) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if ((state.wrap & 4) && hold !== (state.check & 0xffff)) {
            strm.msg = 'header crc mismatch';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        if (state.head) {
          state.head.hcrc = ((state.flags >> 9) & 1);
          state.head.done = true;
        }
        strm.adler = state.check = 0;
        state.mode = TYPE;
        break;
      case DICTID:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        strm.adler = state.check = zswap32(hold);
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = DICT;
        /* falls through */
      case DICT:
        if (state.havedict === 0) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          return Z_NEED_DICT$1;
        }
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = TYPE;
        /* falls through */
      case TYPE:
        if (flush === Z_BLOCK || flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case TYPEDO:
        if (state.last) {
          //--- BYTEBITS() ---//
          hold >>>= bits & 7;
          bits -= bits & 7;
          //---//
          state.mode = CHECK;
          break;
        }
        //=== NEEDBITS(3); */
        while (bits < 3) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.last = (hold & 0x01)/*BITS(1)*/;
        //--- DROPBITS(1) ---//
        hold >>>= 1;
        bits -= 1;
        //---//

        switch ((hold & 0x03)/*BITS(2)*/) {
          case 0:                             /* stored block */
            //Tracev((stderr, "inflate:     stored block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = STORED;
            break;
          case 1:                             /* fixed block */
            fixedtables(state);
            //Tracev((stderr, "inflate:     fixed codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = LEN_;             /* decode codes */
            if (flush === Z_TREES) {
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
              break inf_leave;
            }
            break;
          case 2:                             /* dynamic block */
            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = TABLE;
            break;
          case 3:
            strm.msg = 'invalid block type';
            state.mode = BAD;
        }
        //--- DROPBITS(2) ---//
        hold >>>= 2;
        bits -= 2;
        //---//
        break;
      case STORED:
        //--- BYTEBITS() ---// /* go to byte boundary */
        hold >>>= bits & 7;
        bits -= bits & 7;
        //---//
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
          strm.msg = 'invalid stored block lengths';
          state.mode = BAD;
          break;
        }
        state.length = hold & 0xffff;
        //Tracev((stderr, "inflate:       stored length %u\n",
        //        state.length));
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = COPY_;
        if (flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case COPY_:
        state.mode = COPY;
        /* falls through */
      case COPY:
        copy = state.length;
        if (copy) {
          if (copy > have) { copy = have; }
          if (copy > left) { copy = left; }
          if (copy === 0) { break inf_leave; }
          //--- zmemcpy(put, next, copy); ---
          output.set(input.subarray(next, next + copy), put);
          //---//
          have -= copy;
          next += copy;
          left -= copy;
          put += copy;
          state.length -= copy;
          break;
        }
        //Tracev((stderr, "inflate:       stored end\n"));
        state.mode = TYPE;
        break;
      case TABLE:
        //=== NEEDBITS(14); */
        while (bits < 14) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.nlen = (hold & 0x1f)/*BITS(5)*/ + 257;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ndist = (hold & 0x1f)/*BITS(5)*/ + 1;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ncode = (hold & 0x0f)/*BITS(4)*/ + 4;
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
//#ifndef PKZIP_BUG_WORKAROUND
        if (state.nlen > 286 || state.ndist > 30) {
          strm.msg = 'too many length or distance symbols';
          state.mode = BAD;
          break;
        }
//#endif
        //Tracev((stderr, "inflate:       table sizes ok\n"));
        state.have = 0;
        state.mode = LENLENS;
        /* falls through */
      case LENLENS:
        while (state.have < state.ncode) {
          //=== NEEDBITS(3);
          while (bits < 3) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.lens[order[state.have++]] = (hold & 0x07);//BITS(3);
          //--- DROPBITS(3) ---//
          hold >>>= 3;
          bits -= 3;
          //---//
        }
        while (state.have < 19) {
          state.lens[order[state.have++]] = 0;
        }
        // We have separate tables & no pointers. 2 commented lines below not needed.
        //state.next = state.codes;
        //state.lencode = state.next;
        // Switch to use dynamic table
        state.lencode = state.lendyn;
        state.lenbits = 7;

        opts = { bits: state.lenbits };
        ret = inftrees(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
        state.lenbits = opts.bits;

        if (ret) {
          strm.msg = 'invalid code lengths set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, "inflate:       code lengths ok\n"));
        state.have = 0;
        state.mode = CODELENS;
        /* falls through */
      case CODELENS:
        while (state.have < state.nlen + state.ndist) {
          for (;;) {
            here = state.lencode[hold & ((1 << state.lenbits) - 1)];/*BITS(state.lenbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if (here_val < 16) {
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            state.lens[state.have++] = here_val;
          }
          else {
            if (here_val === 16) {
              //=== NEEDBITS(here.bits + 2);
              n = here_bits + 2;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              if (state.have === 0) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              len = state.lens[state.have - 1];
              copy = 3 + (hold & 0x03);//BITS(2);
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
            }
            else if (here_val === 17) {
              //=== NEEDBITS(here.bits + 3);
              n = here_bits + 3;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 3 + (hold & 0x07);//BITS(3);
              //--- DROPBITS(3) ---//
              hold >>>= 3;
              bits -= 3;
              //---//
            }
            else {
              //=== NEEDBITS(here.bits + 7);
              n = here_bits + 7;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 11 + (hold & 0x7f);//BITS(7);
              //--- DROPBITS(7) ---//
              hold >>>= 7;
              bits -= 7;
              //---//
            }
            if (state.have + copy > state.nlen + state.ndist) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            while (copy--) {
              state.lens[state.have++] = len;
            }
          }
        }

        /* handle error breaks in while */
        if (state.mode === BAD) { break; }

        /* check for end-of-block code (better have one) */
        if (state.lens[256] === 0) {
          strm.msg = 'invalid code -- missing end-of-block';
          state.mode = BAD;
          break;
        }

        /* build code tables -- note: do not change the lenbits or distbits
           values here (9 and 6) without reading the comments in inftrees.h
           concerning the ENOUGH constants, which depend on those values */
        state.lenbits = 9;

        opts = { bits: state.lenbits };
        ret = inftrees(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.lenbits = opts.bits;
        // state.lencode = state.next;

        if (ret) {
          strm.msg = 'invalid literal/lengths set';
          state.mode = BAD;
          break;
        }

        state.distbits = 6;
        //state.distcode.copy(state.codes);
        // Switch to use dynamic table
        state.distcode = state.distdyn;
        opts = { bits: state.distbits };
        ret = inftrees(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.distbits = opts.bits;
        // state.distcode = state.next;

        if (ret) {
          strm.msg = 'invalid distances set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, 'inflate:       codes ok\n'));
        state.mode = LEN_;
        if (flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case LEN_:
        state.mode = LEN;
        /* falls through */
      case LEN:
        if (have >= 6 && left >= 258) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          inffast(strm, _out);
          //--- LOAD() ---
          put = strm.next_out;
          output = strm.output;
          left = strm.avail_out;
          next = strm.next_in;
          input = strm.input;
          have = strm.avail_in;
          hold = state.hold;
          bits = state.bits;
          //---

          if (state.mode === TYPE) {
            state.back = -1;
          }
          break;
        }
        state.back = 0;
        for (;;) {
          here = state.lencode[hold & ((1 << state.lenbits) - 1)];  /*BITS(state.lenbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if (here_bits <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if (here_op && (here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.lencode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((last_bits + here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        state.length = here_val;
        if (here_op === 0) {
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          state.mode = LIT;
          break;
        }
        if (here_op & 32) {
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.back = -1;
          state.mode = TYPE;
          break;
        }
        if (here_op & 64) {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD;
          break;
        }
        state.extra = here_op & 15;
        state.mode = LENEXT;
        /* falls through */
      case LENEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
        //Tracevv((stderr, "inflate:         length %u\n", state.length));
        state.was = state.length;
        state.mode = DIST;
        /* falls through */
      case DIST:
        for (;;) {
          here = state.distcode[hold & ((1 << state.distbits) - 1)];/*BITS(state.distbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if ((here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.distcode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((last_bits + here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        if (here_op & 64) {
          strm.msg = 'invalid distance code';
          state.mode = BAD;
          break;
        }
        state.offset = here_val;
        state.extra = (here_op) & 15;
        state.mode = DISTEXT;
        /* falls through */
      case DISTEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.offset += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
//#ifdef INFLATE_STRICT
        if (state.offset > state.dmax) {
          strm.msg = 'invalid distance too far back';
          state.mode = BAD;
          break;
        }
//#endif
        //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
        state.mode = MATCH;
        /* falls through */
      case MATCH:
        if (left === 0) { break inf_leave; }
        copy = _out - left;
        if (state.offset > copy) {         /* copy from window */
          copy = state.offset - copy;
          if (copy > state.whave) {
            if (state.sane) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break;
            }
// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//          Trace((stderr, "inflate.c too far\n"));
//          copy -= state.whave;
//          if (copy > state.length) { copy = state.length; }
//          if (copy > left) { copy = left; }
//          left -= copy;
//          state.length -= copy;
//          do {
//            output[put++] = 0;
//          } while (--copy);
//          if (state.length === 0) { state.mode = LEN; }
//          break;
//#endif
          }
          if (copy > state.wnext) {
            copy -= state.wnext;
            from = state.wsize - copy;
          }
          else {
            from = state.wnext - copy;
          }
          if (copy > state.length) { copy = state.length; }
          from_source = state.window;
        }
        else {                              /* copy from output */
          from_source = output;
          from = put - state.offset;
          copy = state.length;
        }
        if (copy > left) { copy = left; }
        left -= copy;
        state.length -= copy;
        do {
          output[put++] = from_source[from++];
        } while (--copy);
        if (state.length === 0) { state.mode = LEN; }
        break;
      case LIT:
        if (left === 0) { break inf_leave; }
        output[put++] = state.length;
        left--;
        state.mode = LEN;
        break;
      case CHECK:
        if (state.wrap) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            // Use '|' instead of '+' to make sure that result is signed
            hold |= input[next++] << bits;
            bits += 8;
          }
          //===//
          _out -= left;
          strm.total_out += _out;
          state.total += _out;
          if ((state.wrap & 4) && _out) {
            strm.adler = state.check =
                /*UPDATE_CHECK(state.check, put - _out, _out);*/
                (state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out));

          }
          _out = left;
          // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
          if ((state.wrap & 4) && (state.flags ? hold : zswap32(hold)) !== state.check) {
            strm.msg = 'incorrect data check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   check matches trailer\n"));
        }
        state.mode = LENGTH;
        /* falls through */
      case LENGTH:
        if (state.wrap && state.flags) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if ((state.wrap & 4) && hold !== (state.total & 0xffffffff)) {
            strm.msg = 'incorrect length check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   length matches trailer\n"));
        }
        state.mode = DONE;
        /* falls through */
      case DONE:
        ret = Z_STREAM_END$1;
        break inf_leave;
      case BAD:
        ret = Z_DATA_ERROR$1;
        break inf_leave;
      case MEM:
        return Z_MEM_ERROR$1;
      case SYNC:
        /* falls through */
      default:
        return Z_STREAM_ERROR$1;
    }
  }

  // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

  /*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

  //--- RESTORE() ---
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  //---

  if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
                      (state.mode < CHECK || flush !== Z_FINISH$1))) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if ((state.wrap & 4) && _out) {
    strm.adler = state.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
      (state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out));
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) +
                    (state.mode === TYPE ? 128 : 0) +
                    (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if (((_in === 0 && _out === 0) || flush === Z_FINISH$1) && ret === Z_OK$1) {
    ret = Z_BUF_ERROR;
  }
  return ret;
};


const inflateEnd = (strm) => {

  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }

  let state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK$1;
};


const inflateGetHeader = (strm, head) => {

  /* check state */
  if (inflateStateCheck(strm)) { return Z_STREAM_ERROR$1; }
  const state = strm.state;
  if ((state.wrap & 2) === 0) { return Z_STREAM_ERROR$1; }

  /* save header structure */
  state.head = head;
  head.done = false;
  return Z_OK$1;
};


const inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;

  let state;
  let dictid;
  let ret;

  /* check state */
  if (inflateStateCheck(strm)) { return Z_STREAM_ERROR$1; }
  state = strm.state;

  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR$1;
  }

  /* check for correct dictionary identifier */
  if (state.mode === DICT) {
    dictid = 1; /* adler32(0, null, 0)*/
    /* dictid = adler32(dictid, dictionary, dictLength); */
    dictid = adler32_1(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR$1;
    }
  }
  /* copy dictionary to window using updatewindow(), which will amend the
   existing dictionary if appropriate */
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR$1;
  }
  state.havedict = 1;
  // Tracev((stderr, "inflate:   dictionary set\n"));
  return Z_OK$1;
};


var inflateReset_1 = inflateReset;
var inflateReset2_1 = inflateReset2;
var inflateResetKeep_1 = inflateResetKeep;
var inflateInit_1 = inflateInit;
var inflateInit2_1 = inflateInit2;
var inflate_2$1 = inflate$2;
var inflateEnd_1 = inflateEnd;
var inflateGetHeader_1 = inflateGetHeader;
var inflateSetDictionary_1 = inflateSetDictionary;
var inflateInfo = 'pako inflate (from Nodeca project)';

/* Not implemented
module.exports.inflateCodesUsed = inflateCodesUsed;
module.exports.inflateCopy = inflateCopy;
module.exports.inflateGetDictionary = inflateGetDictionary;
module.exports.inflateMark = inflateMark;
module.exports.inflatePrime = inflatePrime;
module.exports.inflateSync = inflateSync;
module.exports.inflateSyncPoint = inflateSyncPoint;
module.exports.inflateUndermine = inflateUndermine;
module.exports.inflateValidate = inflateValidate;
*/

var inflate_1$2 = {
	inflateReset: inflateReset_1,
	inflateReset2: inflateReset2_1,
	inflateResetKeep: inflateResetKeep_1,
	inflateInit: inflateInit_1,
	inflateInit2: inflateInit2_1,
	inflate: inflate_2$1,
	inflateEnd: inflateEnd_1,
	inflateGetHeader: inflateGetHeader_1,
	inflateSetDictionary: inflateSetDictionary_1,
	inflateInfo: inflateInfo
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function GZheader() {
  /* true if compressed data believed to be text */
  this.text       = 0;
  /* modification time */
  this.time       = 0;
  /* extra flags (not used when writing a gzip file) */
  this.xflags     = 0;
  /* operating system */
  this.os         = 0;
  /* pointer to extra field or Z_NULL if none */
  this.extra      = null;
  /* extra field length (valid if extra != Z_NULL) */
  this.extra_len  = 0; // Actually, we don't need it in JS,
                       // but leave for few code modifications

  //
  // Setup limits is not necessary because in js we should not preallocate memory
  // for inflate use constant limit in 65536 bytes
  //

  /* space at extra (only when reading header) */
  // this.extra_max  = 0;
  /* pointer to zero-terminated file name or Z_NULL */
  this.name       = '';
  /* space at name (only when reading header) */
  // this.name_max   = 0;
  /* pointer to zero-terminated comment or Z_NULL */
  this.comment    = '';
  /* space at comment (only when reading header) */
  // this.comm_max   = 0;
  /* true if there was or will be a header crc */
  this.hcrc       = 0;
  /* true when done reading gzip header (not used when writing a gzip file) */
  this.done       = false;
}

var gzheader = GZheader;

const toString = Object.prototype.toString;

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH, Z_FINISH,
  Z_OK, Z_STREAM_END, Z_NEED_DICT, Z_STREAM_ERROR, Z_DATA_ERROR, Z_MEM_ERROR
} = constants$2;

/* ===========================================================================*/


/**
 * class Inflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[inflate]]
 * and [[inflateRaw]].
 **/

/* internal
 * inflate.chunks -> Array
 *
 * Chunks of output data, if [[Inflate#onData]] not overridden.
 **/

/**
 * Inflate.result -> Uint8Array|String
 *
 * Uncompressed result, generated by default [[Inflate#onData]]
 * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Inflate#push]] with `Z_FINISH` / `true` param).
 **/

/**
 * Inflate.err -> Number
 *
 * Error code after inflate finished. 0 (Z_OK) on success.
 * Should be checked if broken data possible.
 **/

/**
 * Inflate.msg -> String
 *
 * Error message, if [[Inflate.err]] != 0
 **/


/**
 * new Inflate(options)
 * - options (Object): zlib inflate options.
 *
 * Creates new inflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `windowBits`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw inflate
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 * By default, when no options set, autodetect deflate/gzip data format via
 * wrapper header.
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 * const chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
 * const chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * const inflate = new pako.Inflate({ level: 3});
 *
 * inflate.push(chunk1, false);
 * inflate.push(chunk2, true);  // true -> last chunk
 *
 * if (inflate.err) { throw new Error(inflate.err); }
 *
 * console.log(inflate.result);
 * ```
 **/
function Inflate$1(options) {
  this.options = common.assign({
    chunkSize: 1024 * 64,
    windowBits: 15,
    to: ''
  }, options || {});

  const opt = this.options;

  // Force window size for `raw` data, if not set directly,
  // because we have no header for autodetect.
  if (opt.raw && (opt.windowBits >= 0) && (opt.windowBits < 16)) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) { opt.windowBits = -15; }
  }

  // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
  if ((opt.windowBits >= 0) && (opt.windowBits < 16) &&
      !(options && options.windowBits)) {
    opt.windowBits += 32;
  }

  // Gzip header has no info about windows size, we can do autodetect only
  // for deflate. So, if window size not set, force it to max when gzip possible
  if ((opt.windowBits > 15) && (opt.windowBits < 48)) {
    // bit 3 (16) -> gzipped data
    // bit 4 (32) -> autodetect gzip/deflate
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }

  this.err    = 0;      // error code, if happens (0 = Z_OK)
  this.msg    = '';     // error message
  this.ended  = false;  // used to avoid multiple onEnd() calls
  this.chunks = [];     // chunks of compressed data

  this.strm   = new zstream();
  this.strm.avail_out = 0;

  let status  = inflate_1$2.inflateInit2(
    this.strm,
    opt.windowBits
  );

  if (status !== Z_OK) {
    throw new Error(messages[status]);
  }

  this.header = new gzheader();

  inflate_1$2.inflateGetHeader(this.strm, this.header);

  // Setup dictionary
  if (opt.dictionary) {
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) { //In raw mode we need to set the dictionary early
      status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== Z_OK) {
        throw new Error(messages[status]);
      }
    }
  }
}

/**
 * Inflate#push(data[, flush_mode]) -> Boolean
 * - data (Uint8Array|ArrayBuffer): input data
 * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE
 *   flush modes. See constants. Skipped or `false` means Z_NO_FLUSH,
 *   `true` means Z_FINISH.
 *
 * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
 * new output chunks. Returns `true` on success. If end of stream detected,
 * [[Inflate#onEnd]] will be called.
 *
 * `flush_mode` is not needed for normal operation, because end of stream
 * detected automatically. You may try to use it for advanced things, but
 * this functionality was not tested.
 *
 * On fail call [[Inflate#onEnd]] with error code and return false.
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Inflate$1.prototype.push = function (data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  const dictionary = this.options.dictionary;
  let status, _flush_mode, last_avail_out;

  if (this.ended) return false;

  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;

  // Convert data if needed
  if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  for (;;) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }

    status = inflate_1$2.inflate(strm, _flush_mode);

    if (status === Z_NEED_DICT && dictionary) {
      status = inflate_1$2.inflateSetDictionary(strm, dictionary);

      if (status === Z_OK) {
        status = inflate_1$2.inflate(strm, _flush_mode);
      } else if (status === Z_DATA_ERROR) {
        // Replace code with more verbose
        status = Z_NEED_DICT;
      }
    }

    // Skip snyc markers if more data follows and not raw mode
    while (strm.avail_in > 0 &&
           status === Z_STREAM_END &&
           strm.state.wrap > 0 &&
           data[strm.next_in] !== 0)
    {
      inflate_1$2.inflateReset(strm);
      status = inflate_1$2.inflate(strm, _flush_mode);
    }

    switch (status) {
      case Z_STREAM_ERROR:
      case Z_DATA_ERROR:
      case Z_NEED_DICT:
      case Z_MEM_ERROR:
        this.onEnd(status);
        this.ended = true;
        return false;
    }

    // Remember real `avail_out` value, because we may patch out buffer content
    // to align utf8 strings boundaries.
    last_avail_out = strm.avail_out;

    if (strm.next_out) {
      if (strm.avail_out === 0 || status === Z_STREAM_END) {

        if (this.options.to === 'string') {

          let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);

          let tail = strm.next_out - next_out_utf8;
          let utf8str = strings.buf2string(strm.output, next_out_utf8);

          // move tail & realign counters
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);

          this.onData(utf8str);

        } else {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
        }
      }
    }

    // Must repeat iteration if out buffer is full
    if (status === Z_OK && last_avail_out === 0) continue;

    // Finalize if end of stream reached.
    if (status === Z_STREAM_END) {
      status = inflate_1$2.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return true;
    }

    if (strm.avail_in === 0) break;
  }

  return true;
};


/**
 * Inflate#onData(chunk) -> Void
 * - chunk (Uint8Array|String): output data. When string output requested,
 *   each chunk will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Inflate$1.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};


/**
 * Inflate#onEnd(status) -> Void
 * - status (Number): inflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called either after you tell inflate that the input stream is
 * complete (Z_FINISH). By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Inflate$1.prototype.onEnd = function (status) {
  // On success - join
  if (status === Z_OK) {
    if (this.options.to === 'string') {
      this.result = this.chunks.join('');
    } else {
      this.result = common.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};


/**
 * inflate(data[, options]) -> Uint8Array|String
 * - data (Uint8Array|ArrayBuffer): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Decompress `data` with inflate/ungzip and `options`. Autodetect
 * format via wrapper header by default. That's why we don't provide
 * separate `ungzip` method.
 *
 * Supported options are:
 *
 * - windowBits
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako');
 * const input = pako.deflate(new Uint8Array([1,2,3,4,5,6,7,8,9]));
 * let output;
 *
 * try {
 *   output = pako.inflate(input);
 * } catch (err) {
 *   console.log(err);
 * }
 * ```
 **/
function inflate$1(input, options) {
  const inflator = new Inflate$1(options);

  inflator.push(input);

  // That will never happens, if you don't cheat with options :)
  if (inflator.err) throw inflator.msg || messages[inflator.err];

  return inflator.result;
}


/**
 * inflateRaw(data[, options]) -> Uint8Array|String
 * - data (Uint8Array|ArrayBuffer): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * The same as [[inflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function inflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return inflate$1(input, options);
}


/**
 * ungzip(data[, options]) -> Uint8Array|String
 * - data (Uint8Array|ArrayBuffer): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Just shortcut to [[inflate]], because it autodetects format
 * by header.content. Done for convenience.
 **/


var Inflate_1$1 = Inflate$1;
var inflate_2 = inflate$1;
var inflateRaw_1$1 = inflateRaw$1;
var ungzip$1 = inflate$1;

var inflate_1$1 = {
	Inflate: Inflate_1$1,
	inflate: inflate_2,
	inflateRaw: inflateRaw_1$1,
	ungzip: ungzip$1};

const { Deflate, deflate, deflateRaw, gzip } = deflate_1$1;

const { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1;



var Deflate_1 = Deflate;
var deflate_1 = deflate;
var deflateRaw_1 = deflateRaw;
var gzip_1 = gzip;
var Inflate_1 = Inflate;
var inflate_1 = inflate;
var inflateRaw_1 = inflateRaw;
var ungzip_1 = ungzip;
var constants_1 = constants$2;

var pako = {
	Deflate: Deflate_1,
	deflate: deflate_1,
	deflateRaw: deflateRaw_1,
	gzip: gzip_1,
	Inflate: Inflate_1,
	inflate: inflate_1,
	inflateRaw: inflateRaw_1,
	ungzip: ungzip_1,
	constants: constants_1
};

// console.log("get-pgscatalog-scores: getPGS_loadTxts.js loaded")

// load all traits (paginated) and log stats about them to console  
const getScoreUrl = (id, build = 37) => `https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/${id}/ScoringFiles/Harmonized/${id}_hmPOS_GRCh${build}.txt.gz`;
const MAX_PGS_CACHE_BYTES = 300 * 1024 * 1024;
const PGS_KEY_PREFIX = "PGS_Catalog:id-";



function getByteSize(value) {
    const encoded = JSON.stringify(value) ?? "";
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(encoded).length;
    }
    return encoded.length * 2;
}

async function getTxts(ids, _unused, cache = true) {
    // console.log("getTxts()", ids)
    let data = await Promise.all(ids.map(async (id, i) => {
        let score = null;

        if (cache) {
            score = await localforage.getItem(`${PGS_KEY_PREFIX}${id}`);
            // console.log(`Cache lookup for ${PGS_KEY_PREFIX}${id}:`, score ? "HIT" : "MISS")
        }

        if (score == null) {
            // console.log(`Cache miss for ${id}. Fetching from network...`)
            score = await parseScore(id, await fetchScore(id));
            if (cache) {
                score.cachedAt = Date.now();
                await localforage.setItem(`${PGS_KEY_PREFIX}${id}`, score);
            }
        }
        return score
    })
    );
    if (cache) {
        await limitStorage(ids);
    }
    return data
}


// evicts in this order:First: cached PGS_Catalog:id-* entries whose IDs are not in current ids.
// Then (only if still over limit): entries whose IDs are in current ids.
async function limitStorage(ids = []){
    const entries = [];
    let totalBytes = 0;
    const requestedIds = new Set((ids || []).map(id => String(id)));

    await localforage.iterate((value, key) => {
        if (!key.startsWith(PGS_KEY_PREFIX)) {
            return;
        }
        const entryBytes = getByteSize({ key, value });
        const createdAt = Number(value?.cachedAt) || 0;
        const id = key.slice(PGS_KEY_PREFIX.length);

        entries.push({ key, id, entryBytes, createdAt });
        totalBytes += entryBytes;
        //console.log(`Cached pgs entries: ${key}, Size: ${(entryBytes / 1024 / 1024).toFixed(2)} MB`);
    });

    if (totalBytes < MAX_PGS_CACHE_BYTES) {
        // console.log(`Cache limit: ${(MAX_PGS_CACHE_BYTES / 1024 / 1024).toFixed(0)} MB. Current usage: ${(totalBytes / 1024 / 1024).toFixed(2)} MB. No eviction needed.`);
        return;
    }

    const notRequestedEntries = entries
        .filter(entry => !requestedIds.has(entry.id))
        .sort((a, b) => a.createdAt - b.createdAt);

    const requestedEntries = entries
        .filter(entry => requestedIds.has(entry.id))
        .sort((a, b) => a.createdAt - b.createdAt);

    const evictionOrder = [...notRequestedEntries, ...requestedEntries];

    for (const entry of evictionOrder) {
        if (totalBytes < MAX_PGS_CACHE_BYTES) {
            break;
        }
        await localforage.removeItem(entry.key);
        totalBytes -= entry.entryBytes;
    }
    // console.log(`Cache after eviction: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

}

async function fetchScore(id = 'PGS000050', build = 37, range) {
    // console.log("loadScore")
    let txt = "";
    const MAX_ROWS = 1000000;

    const url = getScoreUrl(id, build);
    // console.log("loading harmonized pgs score from url", url)

    {
        txt = pako.inflate(await (await fetch(url)).arrayBuffer(), {
            to: 'string'
        });
    }

    const rowCount = txt.split(/\r\n|\n|\r/g).length;
    if (rowCount > MAX_ROWS) {
        return "failed to fetch. File freater than 1M rows!"
    }

    // Check if PGS catalog FTP site is down-----------------------
    let response;
    response = await fetch(url); // testing url 'https://httpbin.org/status/429'
    if (response?.ok) ; else {
        txt = `:( Error loading PGS file. HTTP Response Code: ${response?.status}`;
        document.getElementById('pgsTextArea').value = txt;
    }
    return txt
}

// create PGS obj and data --------------------------
async function parseScore(id, txt) {
    let obj = {
        id: id
    };
    obj.txt = txt;
    let rows = obj.txt.split(/[\r\n]/g);
    let metaL = rows.filter(r => (r[0] == '#')).length;
    obj.meta = {
        txt: rows.slice(0, metaL)
    };
    obj.cols = rows[metaL].split(/\t/g);
    obj.dt = rows.slice(metaL + 1).map(r => r.split(/\t/g));
    if (obj.dt.slice(-1).length == 1) {
        obj.dt.pop(-1);
    }
    // parse numerical types
    const indInt = [obj.cols.indexOf('chr_position'), obj.cols.indexOf('hm_pos')];
    const indFloat = [obj.cols.indexOf('effect_weight'), obj.cols.indexOf('allelefrequency_effect')];
    const indBol = [obj.cols.indexOf('hm_match_chr'), obj.cols.indexOf('hm_match_pos')];

    // /* this is the efficient way to do it, but for large files it has memory issues
    obj.dt = obj.dt.map(r => {
        // for each data row
        indFloat.forEach(ind => {
            r[ind] = parseFloat(r[ind]);
        });
        indInt.forEach(ind => {
            r[ind] = parseInt(r[ind]);
        });
        indBol.forEach(ind => {
            r[ind] = (r[11] == 'True') ? true : false;
        });
        return r
    });
    // parse metadata
    obj.meta.txt.filter(r => (r[1] != '#')).forEach(aa => {
        aa = aa.slice(1).split('=');
        obj.meta[aa[0]] = aa[1];
    });
    return obj
}

async function estimateLocalForageSizeKB() {
  let total = 0;

  await localforage.iterate((value, key) => {
    const size = new Blob([JSON.stringify(value)]).size;
    total += size;
  });

  const totalKB = total / 1024;
  console.log("LocalForage size:", totalKB.toFixed(2), "KB");
  return totalKB;
}

async function checkStorageKB() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    const usageKB = usage / 1024;
    const quotaKB = quota / 1024;

    console.log("Used:", usageKB.toFixed(2), "KB");
    console.log("Quota:", quotaKB.toFixed(2), "KB");
    console.log("Percent used:", ((usageKB / quotaKB) * 100).toFixed(2) + "%");

    return { usage, quota, usageKB, quotaKB };
  } else {
    console.log("Storage API not supported");
  }
}

function getTextSizeKB(text) {
  try {
    const textValue = typeof text === "string" ? text : JSON.stringify(text);
    const sizeBytes = new Blob([textValue ?? ""]).size;
    const sizeKB = sizeBytes / 1024;
    console.log(`Size: ${sizeBytes} bytes (${sizeKB.toFixed(2)} KB)`);
    return sizeKB;
  } catch (error) {
    const message = error?.message ?? String(error);
    console.error(`getTextSizeKB() failed: ${message}`);
    throw new Error(`Unable to calculate text size: ${message}`);
  }
}

export { checkStorageKB, estimateLocalForageSizeKB, fetchAllScores, fetchDataAndRenderPlots, fetchSomeScores, fetchTraits, getScoresPerCategory, getScoresPerTrait, getTextSizeKB, getTxts, loadScoreStats, localforage };
//# sourceMappingURL=sdk.mjs.map
