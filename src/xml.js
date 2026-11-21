const { spawnSync } = require('node:child_process');
const path = require('node:path');

/** libxml2-backed XPath stays synchronous, matching the contract of preprocessing scripts. */
function convert(operation, data, expression) {
  const python = process.env.ZABBIX_JS_PYTHON || 'python3';
  const result = spawnSync(python, [path.join(__dirname, 'xml_worker.py')], {
    input: JSON.stringify({ operation, data, expression }),
    encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'XML conversion failed.');
  return JSON.parse(result.stdout);
}

const XML = {
  query: (data, expression) => convert('query', data, expression),
  toJson: (data) => convert('toJson', data),
  fromJson: (data) => convert('fromJson', data),
};

module.exports = { XML };
