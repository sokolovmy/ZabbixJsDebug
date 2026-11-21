const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const authFlags = { HTTPAUTH_NONE: 0, HTTPAUTH_BASIC: 1, HTTPAUTH_DIGEST: 2, HTTPAUTH_NEGOTIATE: 4, HTTPAUTH_NTLM: 8 };
const authOptions = [[1, '--basic'], [2, '--digest'], [4, '--negotiate'], [8, '--ntlm']];
const verbs = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace', 'connect'];

/** Ignore interim responses (for example 100 Continue) and retain duplicate headers. */
function parseHeaders(text) {
  const block = text.trim().split(/\r?\n\r?\n/).at(-1);
  const headers = new Map();
  for (const line of block.split(/\r?\n/).slice(1)) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const name = line.slice(0, colon);
    const key = name.toLowerCase();
    if (!headers.has(key)) headers.set(key, { name, values: [] });
    headers.get(key).values.push(line.slice(colon + 1).trim());
  }
  return headers;
}

function contentType(data) {
  try {
    JSON.parse(data);
    return 'application/json';
  } catch {
    return 'text/plain';
  }
}

/** Separate response headers and body: neither a blank line nor a header-like body is ambiguous. */
function perform(state, method, url, data) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zbx-http-'));
  try {
    const headers = path.join(directory, 'headers');
    const args = ['-q', '--silent', '--proto', '=http,https', '--globoff', '--max-time', '20',
      '--dump-header', headers, '--write-out', '\n%{http_code}', '--request', method];
    if (method === 'HEAD') args.push('--head', '--output', os.devNull);
    if (state.proxy !== undefined) args.push('--proxy', state.proxy);
    for (const header of state.outgoing) args.push('--header', header);
    if (data !== undefined && method !== 'HEAD') {
      args.push('--data-binary', '@-');
      if (!state.outgoing.length) args.push('--header', `Content-Type: ${contentType(data)}`);
    }
    args.push(...state.auth, '--url', String(url));
    const result = spawnSync('curl', args, {
      input: data === undefined ? '' : String(data), encoding: 'utf8', timeout: 22000, maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`curl (${result.status}) failed; check endpoint and local curl features.`);
    const end = result.stdout.lastIndexOf('\n');
    state.status = Number(result.stdout.slice(end + 1));
    state.received = parseHeaders(fs.readFileSync(headers, 'utf8'));
    return result.stdout.slice(0, end);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/** Build one prototype per naming family; do not expose modern methods through a legacy instance. */
function createRequestType(legacy) {
  let instances = 0;
  const states = new WeakMap();
  class Request {
    constructor() {
      if (++instances > 10) throw new Error('At most ten HTTP objects may be created per run.');
      states.set(this, { outgoing: [], received: new Map(), status: 0, auth: [] });
    }
  }
  const methods = {
    addHeader(state, header) {
      const entries = [...state.outgoing, String(header)];
      if (Buffer.byteLength(entries.join('\r\n')) > 128 * 1024) throw new Error('Header budget exceeded.');
      state.outgoing = entries;
    },
    clearHeader(state) { state.outgoing = []; },
    getStatus(state) { return state.status; },
    getHeaders(state, asArray = false) {
      return Object.fromEntries(Array.from(state.received.values(), ({ name, values }) =>
        [name, asArray ? [...values] : values.at(-1)]));
    },
    setProxy(state, proxy) { state.proxy = String(proxy); },
    setHttpAuth(state, mask, user = '', password = '') {
      if (!Number.isInteger(mask) || mask < 0 || mask > 15) throw new Error('Invalid HTTP auth mask.');
      state.auth = mask ? [...authOptions.filter(([bit]) => mask & bit).map(([, flag]) => flag), '--user', `${user}:${password}`] : [];
    },
    customRequest: perform,
  };
  for (const verb of verbs) methods[verb] = (state, url, data) => perform(state, verb.toUpperCase(), url, data);
  for (const [name, handler] of Object.entries(methods)) {
    const legacyName = name === 'getStatus' ? 'Status' : name[0].toUpperCase() + name.slice(1);
    Request.prototype[legacy ? legacyName : name] = function (...args) {
      return handler(states.get(this), ...args);
    };
  }
  return Request;
}

module.exports = { authFlags, createRequestType };
