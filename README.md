# Zabbix JS Debug

Debug a Zabbix JavaScript preprocessing step or Script item in VS Code before copying it into a template. Use the script as it appears in Zabbix: `value` is supplied for you, and `return` works at the top level. The default Node.js debugger lets you pause on a line, inspect variables and step through the script. No Zabbix server or `launch.json` is needed for this workflow.

## Install the runtime dependencies

For ordinary debugging you only need Node.js 18 or later. Install curl if your script makes HTTP requests. Install Python with `lxml` only if it calls `XML.*`. Run the commands for your operating system in a terminal **before** launching VS Code. If you use WSL or Remote SSH, install the tools on the host where the extension runs.

### Linux (Ubuntu or Debian, Bash)

```sh
sudo apt update
sudo apt install -y nodejs
node --version
```

If your distribution ships a Node version older than 18, install a supported Node.js LTS release instead. For HTTP:

```sh
sudo apt install -y curl
curl --version
```

For XML, use the distribution's Python and matching `lxml` package:

```sh
sudo apt install -y python3 python3-lxml
export ZABBIX_JS_PYTHON=/usr/bin/python3
"$ZABBIX_JS_PYTHON" -c "from lxml import etree; print(etree.LXML_VERSION)"
```

### macOS (Homebrew, Terminal)

With [Homebrew](https://brew.sh/) installed, run:

```sh
brew install node
node --version
```

macOS already includes curl. Check it with `curl --version`. For XML, use a virtual environment so you do not modify Homebrew's Python installation:

```sh
brew install python
python3 -m venv "$HOME/.venvs/zabbix-js-debug"
export ZABBIX_JS_PYTHON="$HOME/.venvs/zabbix-js-debug/bin/python"
"$ZABBIX_JS_PYTHON" -m pip install lxml
"$ZABBIX_JS_PYTHON" -c "from lxml import etree; print(etree.LXML_VERSION)"
```

On Linux and macOS, `export` applies to the current shell. Fully quit VS Code and run `code .` from that shell to pass the interpreter path to the extension. To reuse it across terminal sessions, add the `export` line to your shell profile. On macOS, if `code` is not on PATH, use **Shell Command: Install 'code' command in PATH** from the Command Palette.

### Windows (PowerShell with WinGet)

```powershell
winget install --id OpenJS.NodeJS.LTS --exact
```

For XML support, also install Python:

```powershell
winget install --id Python.Python.3.12 --exact
```

Open a new PowerShell window after installing. Verify Node with `node --version`. For HTTP, check the Windows curl executable with `curl.exe --version` (not the PowerShell alias). If it is missing, install it and open a new terminal:

```powershell
winget install --id cURL.cURL --exact
```

For XML, create the environment and save its interpreter path for future VS Code sessions. PowerShell activation is not required:

```powershell
$venv = Join-Path $env:LOCALAPPDATA 'ZabbixJsDebug\venv'
py -3.12 -m venv $venv
$env:ZABBIX_JS_PYTHON = Join-Path $venv 'Scripts\python.exe'
& $env:ZABBIX_JS_PYTHON -m pip install lxml
& $env:ZABBIX_JS_PYTHON -c "from lxml import etree; print(etree.LXML_VERSION)"
[Environment]::SetEnvironmentVariable('ZABBIX_JS_PYTHON', $env:ZABBIX_JS_PYTHON, 'User')
```

Fully exit VS Code and reopen it after changing PATH or the Python environment. To install a locally built extension package on any platform, run `code --install-extension ./extension.vsix` from the directory containing the VSIX, or choose **Extensions: Install from VSIX** in VS Code.

## Choose the API names

In `.vscode/settings.json`, select the naming family used by your script:

```json
{ "zabbixJsDebug.naming": "modern" }
```

| Setting | When to use it | Log a debug message |
| --- | --- | --- |
| `modern` (default) | Names introduced in 5.4: `HttpRequest`, `getStatus()` | `Zabbix.log(4, 'Reading temperature');` |
| `legacy` | Names used before 5.4: `CurlHttpRequest`, `Status()` | `Zabbix.Log(4, 'Reading temperature');` |

Names are case-sensitive. The following examples use `modern`. Logging writes to the Debug Console; `return` supplies the item value.

## Debug your first value

Install the extension, make sure `node` is on your PATH (Node.js 18 or later), and open a trusted folder in VS Code. Create these two files side by side:

**temperature.js**
```js
const raw = Number(value);
Zabbix.log(4, 'Raw temperature: ' + raw);
return raw / 10;
```

**temperature.value**
```json
{ "value": "253" }
```

Open `temperature.js`, set a breakpoint on `return`, then open the Command Palette and run **Zabbix JS Debug: Debug Active Script**. At the breakpoint, inspect `raw` in **Run and Debug → Variables**. Press **Continue**: the **Debug Console** prints `25.3`. You can also use F5 and select **Zabbix JS Debug** if prompted.

## Pass Script item parameters

Use `params` instead of `value` in the `.value` file. Each parameter is a string:

```json
{ "params": { "host": "demo", "port": "443" } }
```

The script receives JSON text in `value`, not a global `params` variable:

```js
const params = JSON.parse(value);
return params.host + ':' + params.port;
```

A `.value` file must contain exactly one of these fields. If the file is absent, preprocessing starts with an empty string.

## Use Zabbix macros

Create `.zabbix/macros.json` at the root of the folder open in VS Code:

```json
{ "{$SCALE}": "10", "{$TOKEN}": { "env": "ZBX_TOKEN" } }
```

You can now write `return Number(value) / {$SCALE};`. For a Script item, put macros in parameter values instead. After launch, **Run and Debug → Macro** lists the configured entries. Environment references are masked; keep secrets out of committed JSON and script output. Macros are substituted before execution. The Macro view is read-only. Edit the JSON file and start a new run to apply a change.

## Runtime requirements



The Node runtime includes synchronous HTTP methods, response headers, proxy and authentication settings; logging and sleep; Base64, digest, HMAC and RSA helpers; and `XML.query`, `XML.toJson`, `XML.fromJson`. Install curl for HTTP. For XML only, install Python 3 with `lxml` (for example in a virtual environment) and optionally set `ZABBIX_JS_PYTHON` to the interpreter path before starting VS Code. The modern Base64 decoder returns bytes; the legacy decoder returns text. HTTP uses real endpoints. Local curl and its installed authentication backends determine which network operations succeed.

`zabbixJsDebug.inputFile` and `zabbixJsDebug.macrosFile` override file locations. The default macros file is relative to the **opened workspace**, not necessarily the script's directory. `zabbixJsDebug.runtimePath` selects an executable outside PATH.

This extension targets preprocessing and Script items, not WebDriver Browser items or the Zabbix JSON-RPC API. Node is not a Duktape emulator: resource limits, authentication negotiation, encoding and XML serialization can differ. Validate deployment-sensitive scripts against your target installation.
