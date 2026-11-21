const t = require('node:test'), a = require('node:assert/strict'), path = require('node:path'), { prepare, load } = require('../src/core'), { api } = require('../src/api');
t('preprocessing: literal, whitespace, no input expansion', () => a.deepEqual(prepare('return {$X};', { value: ' {$X}\n' }, { '{$X}': '12' }), { body: 'return 12;', value: ' {$X}\n' }));
t('params: structured expansion and escaping', () => { const r = prepare('return value;', { params: { x: '{$X}' } }, { '{$X}': { env: 'X' } }, { X: '"\n$&' }); a.deepEqual(JSON.parse(r.value), { x: '"\n$&' }); });
t('missing macro', () => a.throws(() => prepare('{$X}', { value: '' }, {}), /Missing macro value/));
t('invalid inputs', () => { for (const x of [{}, { value: '', params: {} }, { value: 1 }, { params: { x: 5 } }])
    a.throws(() => prepare('', x, {})); });
t('runner: example', () => { const root = path.resolve(__dirname, '../examples'); const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, '../src/runner.js'), JSON.stringify({ file: path.join(root, 'temperature.js'), input: path.join(root, 'temperature.value'), macros: path.join(root, '.zabbix/macros.json'), naming: 'modern', runtime: 'node' })], { encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }); a.equal(r.status, 0, r.stderr); a.equal(r.stdout.trim(), '25.3'); });
