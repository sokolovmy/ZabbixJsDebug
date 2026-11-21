/** File and input preparation shared by the Node and native runners. */
const fs = require('node:fs');
const path = require('node:path');
const macro = /\{\$[A-Z0-9_.]+\}/g;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A missing optional file uses its default; an unreadable or malformed file does not. */
function read(file, fallback) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`Invalid JSON: ${file}`);
  }
}

/** Resolve supported path placeholders against the active document. */
function location(template, file, root) {
  const variables = {
    fileDirname: path.dirname(file),
    fileBasenameNoExtension: path.parse(file).name,
    workspaceFolder: root,
  };
  const expanded = template.replace(/\$\{([^}]+)\}/g, (_, key) => {
    if (!Object.hasOwn(variables, key)) throw new Error(`Unknown path variable: ${key}`);
    return variables[key];
  });
  return path.resolve(root, expanded);
}

/** Preprocessing substitutes source text; Script items substitute data before serialization. */
function prepare(source, input, macros, env = process.env) {
  if (!isObject(macros)) throw new Error('Expected a JSON object in the macros file.');
  function expand(text) {
    return text.replace(macro, key => {
      const entry = macros[key];
      if (typeof entry === 'string') return entry;
      if (typeof entry?.env === 'string' && Object.hasOwn(env, entry.env)) return env[entry.env];
      throw new Error(`Missing macro value: ${key}`);
    });
  }
  if (!isObject(input) || Object.keys(input).length !== 1) {
    throw new Error('The .value file must contain exactly one field: value or params.');
  }
  if (typeof input.value === 'string') return { body: expand(source), value: input.value };
  if (!isObject(input.params)) throw new Error('Expected a string value or a params object.');
  const params = Object.create(null);
  for (const [key, value] of Object.entries(input.params)) {
    if (typeof value !== 'string') throw new Error(`params.${key} must be a string.`);
    params[key] = expand(value);
  }
  return { body: source, value: JSON.stringify(params) };
}

function load(spec) {
  const source = fs.readFileSync(spec.file, 'utf8');
  return prepare(source, read(spec.input, { value: '' }), read(spec.macros, {}));
}

module.exports = { read, location, prepare, load, macro };
