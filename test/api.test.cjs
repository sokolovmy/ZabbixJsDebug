const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { api } = require('../src/api');
const modern = api('modern', () => {});
const legacy = api('legacy', () => {});

test('profiles expose the expected names', () => {
  assert.equal(legacy.HttpRequest, undefined);
  assert.equal(modern.CurlHttpRequest, undefined);
  assert.equal(new legacy.CurlHttpRequest().Status(), 0);
  assert.equal(typeof modern.Zabbix.log, 'function');
  assert.equal(typeof legacy.Zabbix.Log, 'function');
});

test('binary helpers preserve bytes and support UTF-8 text', () => {
  const input = Uint8Array.of(0, 128, 255);
  assert.deepEqual(modern.atob(modern.btoa(input)), input);
  assert.equal(legacy.atob(legacy.btoa('café')), 'café');
  assert.equal(modern.md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(modern.hmac('sha256', 'key', input), crypto.createHmac('sha256', 'key').update(input).digest('hex'));
});

test('verify the generated RSA signature independently', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const signature = Buffer.from(modern.sign('sha256', pem, 'abc'), 'hex');
  assert.ok(crypto.verify('sha256', Buffer.from('abc'), publicKey, signature));
});

test('XML preserves attributes and repeated children; XPath supports predicates', () => {
  const xml = '<r id="1"><a>x</a><a>y</a><b/></r>';
  const json = modern.XML.toJson(xml);
  assert.deepEqual(JSON.parse(json), { r: { '@id': '1', a: ['x', 'y'], b: null } });
  assert.equal(modern.XML.query(modern.XML.fromJson(json), '/r/a[2]/text()'), 'y');
  assert.equal(modern.XML.query(xml, '/missing'), null);
});
