const vscode = require('vscode');
const { read } = require('./core');

/** Present configuration only. Never resolve a secret for display in the debugger. */
function registerMacroPanel(context) {
  const changes = new vscode.EventEmitter();
  let entries = [];
  const provider = {
    onDidChangeTreeData: changes.event,
    getChildren: () => entries,
    getTreeItem([name, value]) {
      const item = new vscode.TreeItem(name);
      item.description = typeof value === 'string' ? JSON.stringify(value) : `env: ${value?.env ?? '?'}`;
      return item;
    },
  };
  context.subscriptions.push(changes, vscode.window.registerTreeDataProvider('zabbixJs.macros', provider));
  return (file) => {
    entries = Object.entries(read(file, {}));
    changes.fire();
  };
}

module.exports = { registerMacroPanel };
