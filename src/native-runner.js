/** Stream native runtime output to VS Code; do not imply breakpoint support. */
const vscode = require('vscode');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { load } = require('./core');

function execute(executable, script, value, cwd, output, cancellation) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-s', script, '-i', '-'], { cwd });
    const listener = cancellation.onCancellationRequested(() => child.kill());
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8').on('data', chunk => output.append(chunk));
    }
    child.once('error', reject);
    child.once('close', code => {
      listener.dispose();
      if (code === 0 || cancellation.isCancellationRequested) resolve();
      else reject(new Error(`Runtime exited with code ${code}.`));
    });
    // A failed launch may close stdin before the parent has finished writing.
    child.stdin.on('error', () => {});
    child.stdin.end(value);
  });
}

/** Keep expanded source in a private temporary directory only for this run. */
async function runNative(spec, root, output) {
  const { body, value } = load(spec);
  output.show(true);
  output.appendLine('Native execution: breakpoints are not available.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zabbix-js-'));
  try {
    const script = path.join(directory, 'body.js');
    fs.writeFileSync(script, body, { mode: 0o600 });
    const options = {
      location: vscode.ProgressLocation.Notification,
      title: `Zabbix JS Debug: ${path.basename(spec.file)}`,
      cancellable: true,
    };
    await vscode.window.withProgress(options, (_, token) =>
      execute(spec.bin || 'zabbix_js', script, value, root, output, token));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { runNative };
