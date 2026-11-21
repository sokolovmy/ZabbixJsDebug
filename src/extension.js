/** Connect VS Code commands to a runtime without requiring a launch.json file. */
const vscode = require('vscode');
const path = require('node:path');
const { location } = require('./core');
const { runNative } = require('./native-runner');
const { registerMacroPanel } = require('./macro-panel');

const DEBUG_TYPE = 'zabbix-js';
const initial = () => [{ type: DEBUG_TYPE, request: 'launch', name: 'Zabbix JS Debug' }];

/** Use the workspace containing the script, not the first folder in the window. */
function getLaunchSpec(file, root, settings) {
  return {
    file,
    input: location(settings.get('inputFile'), file, root),
    macros: location(settings.get('macrosFile'), file, root),
    naming: settings.get('naming'),
    runtime: settings.get('runtime'),
    bin: settings.get('runtimePath'),
  };
}

function nodeConfiguration(context, spec, root) {
  const internals = context.asAbsolutePath('src').split(path.sep).join('/');
  return {
    type: 'pwa-node', request: 'launch', name: path.basename(spec.file),
    runtimeExecutable: spec.bin || 'node',
    program: context.asAbsolutePath('src/runner.js'),
    args: [JSON.stringify(spec)], cwd: root, console: 'internalConsole',
    skipFiles: ['<node_internals>/**', `${internals}/**`],
    smartStep: true, stopOnEntry: false, enableContentValidation: false,
  };
}

function activate(context) {
  const output = vscode.window.createOutputChannel('Zabbix JS Debug');
  const refreshMacros = registerMacroPanel(context);
  async function start() {
    try {
      const document = vscode.window.activeTextEditor?.document;
      if (!vscode.workspace.isTrusted || document?.uri.scheme !== 'file' || !document.fileName.endsWith('.js')) {
        throw new Error('Open a local JavaScript file in a trusted workspace.');
      }
      if (document.isDirty && !(await document.save())) return;
      const folder = vscode.workspace.getWorkspaceFolder(document.uri);
      const settings = vscode.workspace.getConfiguration('zabbixJsDebug', document.uri);
      const root = folder?.uri.fsPath || path.dirname(document.fileName);
      const spec = getLaunchSpec(document.fileName, root, settings);
      refreshMacros(spec.macros);
      await vscode.commands.executeCommand('setContext', 'zabbixJs.hasMacroSnapshot', true);
      const adapter = settings.get('duktapeAdapterPath');
      if (spec.runtime === 'node') {
        await vscode.debug.startDebugging(folder, nodeConfiguration(context, spec, root));
      } else if (adapter) {
        await vscode.debug.startDebugging(folder, { ...initial()[0], ...spec, adapter });
      } else {
        await runNative(spec, root, output);
      }
    } catch (error) {
      vscode.window.showErrorMessage(error.message);
    }
  }

  const provider = {
    provideDebugConfigurations: initial,
    async resolveDebugConfiguration(folder, configuration) {
      // An external adapter handles its own launch. All other requests delegate once.
      if (configuration.adapter) return configuration;
      await start();
      return null;
    },
  };
  const factory = {
    createDebugAdapterDescriptor(session) {
      return new vscode.DebugAdapterExecutable(session.configuration.adapter, []);
    },
  };
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('zabbixJs.start', start),
    vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPE, provider),
    vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPE, { provideDebugConfigurations: initial },
      vscode.DebugConfigurationProviderTriggerKind.Dynamic),
    vscode.debug.registerDebugAdapterDescriptorFactory(DEBUG_TYPE, factory),
  );
}

module.exports = { activate };
