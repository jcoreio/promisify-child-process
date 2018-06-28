'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.execFile = exports.exec = undefined;
exports.promisifyChildProcess = promisifyChildProcess;
exports.spawn = spawn;
exports.fork = fork;

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function promisifyChildProcess(child) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var _promise = new Promise(function (resolve, reject) {
    var stdout = void 0,
        stderr = void 0;
    if (options.encoding && options.encoding !== 'buffer') {
      stdout = child.stdout ? '' : null, stderr = child.stderr ? '' : null;
      if (stdout != null) child.stdout.on('data', function (data) {
        return stdout += data;
      });
      if (stderr != null) child.stderr.on('data', function (data) {
        return stderr += data;
      });
    } else {
      stdout = child.stdout ? Buffer.alloc(0) : null, stderr = child.stderr ? Buffer.alloc(0) : null;
      if (stdout != null) child.stdout.on('data', function (data) {
        return stdout = Buffer.concat([stdout, data]);
      });
      if (stderr != null) child.stderr.on('data', function (data) {
        return stderr = Buffer.concat([stderr, data]);
      });
    }
    child.on('error', reject);
    function done(code, signal) {
      var error = void 0;
      if (code != null && code !== 0) error = new Error('Process exited with code ' + code);else if (signal != null) error = new Error('Process was killed with ' + signal);
      if (error) {
        if (code != null) error.code = code;
        if (signal != null) error.signal = signal;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout: stdout, stderr: stderr });
      }
    }
    child.on('close', done);
    child.on('exit', done);
  });
  return Object.create(child, {
    then: { value: _promise.then.bind(_promise) },
    catch: { value: _promise.catch.bind(_promise) }
  });
}

function spawn(command, args, options) {
  return promisifyChildProcess(_child_process2.default.spawn(command, args, options), Array.isArray(args) ? options : args);
}

function fork(module, args, options) {
  return promisifyChildProcess(_child_process2.default.fork(module, args, options), Array.isArray(args) ? options : args);
}

function promisifyExecMethod(method) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var child = void 0;
    var _promise = new Promise(function (resolve, reject) {
      child = method.apply(undefined, args.concat([function (err, stdout, stderr) {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        } else {
          resolve({ stdout: stdout, stderr: stderr });
        }
      }]));
    });
    if (!child) throw new Error("unexpected error: child has not been initialized");
    return Object.create(child, {
      then: { value: _promise.then.bind(_promise) },
      catch: { value: _promise.catch.bind(_promise) }
    });
  };
}

var exec = exports.exec = promisifyExecMethod(_child_process2.default.exec);

var execFile = exports.execFile = promisifyExecMethod(_child_process2.default.execFile);