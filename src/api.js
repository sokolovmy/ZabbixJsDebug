const { encodingApi } = require('./crypto');
const { createRequestType, authFlags } = require('./http');
const { XML } = require('./xml');

/** Each execution gets independent request and log budgets. */
function api(naming = 'modern', sink) {
  if (!['legacy', 'modern'].includes(naming)) throw new Error('Unknown API naming profile.');
  const legacy = naming === 'legacy';
  let loggedBytes = 0;
  function log(level, message) {
    const text = typeof message === 'string' ? message : JSON.stringify(message) ?? String(message);
    loggedBytes += Buffer.byteLength(text);
    if (loggedBytes > 8 * 1024 * 1024) throw new Error('Log budget exceeded.');
    sink(level, text);
  }
  function sleep(delay) {
    if (!Number.isFinite(+delay) || delay < 0) throw new RangeError('Expected a delay in milliseconds.');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, +delay);
  }
  return {
    ...authFlags,
    ...encodingApi(legacy),
    XML,
    console: { log: (message) => log(4, message), warn: (message) => log(3, message), error: (message) => log(2, message) },
    Zabbix: { [legacy ? 'Log' : 'log']: log, sleep },
    [legacy ? 'CurlHttpRequest' : 'HttpRequest']: createRequestType(legacy),
  };
}

module.exports = { api };
