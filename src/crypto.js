const crypto = require('node:crypto');
const { types } = require('node:util');

/** Accept typed arrays created in the guest VM, including slices with nonzero offsets. */
function bytes(value) {
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (types.isAnyArrayBuffer(value)) return Buffer.from(value);
  if (value == null) throw new TypeError('Expected text or binary data.');
  return Buffer.from(String(value), 'utf8');
}

function digest(algorithm, value) {
  return crypto.createHash(algorithm).update(bytes(value)).digest('hex');
}

function hmac(algorithm, key, data) {
  if (!['md5', 'sha256'].includes(algorithm)) throw new Error('Expected md5 or sha256.');
  return crypto.createHmac(algorithm, bytes(key)).update(bytes(data)).digest('hex');
}

/** Macros sometimes carry a JSON-quoted PEM or a single-line copy of the key. */
function sign(algorithm, key, data) {
  if (algorithm !== 'sha256') throw new Error('Expected sha256.');
  let pem = bytes(key).toString().trim();
  if (pem.startsWith('"')) pem = JSON.parse(pem);
  pem = pem.replace(/\\n/g, '\n').replace(/(-----BEGIN (?:RSA )?PRIVATE KEY-----)([\s\S]*?)(-----END (?:RSA )?PRIVATE KEY-----)/,
    (_, begin, body, end) => [begin, body.replace(/\s/g, ''), end].join('\n'));
  const privateKey = crypto.createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'rsa') throw new Error('Expected an RSA private key.');
  return crypto.sign('sha256', bytes(data), privateKey).toString('hex');
}

function encodingApi(legacy) {
  return {
    btoa: (data) => bytes(data).toString('base64'),
    atob: (data) => {
      const buffer = Buffer.from(data, 'base64');
      return legacy ? buffer.toString('utf8') : Uint8Array.from(buffer);
    },
    md5: (data) => digest('md5', data),
    sha256: (data) => digest('sha256', data),
    hmac,
    sign,
  };
}

module.exports = { encodingApi };
