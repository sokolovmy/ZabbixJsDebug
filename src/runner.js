/** Compile the user file as a function body so line numbers match the editor. */
const vm = require('node:vm');
const { load } = require('./core');
const { api } = require('./api');

function run(spec) {
  const { body, value } = load(spec);
  const log = (level, message) => console.error(`[${level}] ${message}`);
  const script = vm.compileFunction(body, ['value'], {
    filename: spec.file,
    parsingContext: vm.createContext(api(spec.naming, log)),
  });
  console.log(script(value));
}

if (require.main === module) run(JSON.parse(process.argv[2]));
module.exports = { run };
