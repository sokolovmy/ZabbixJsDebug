# Maintaining Zabbix JS Debug

## Set up a working copy

Use Node.js 22 and npm. When bootstrapping a new repository from the patch, set `repository.url` to your GitHub URL and `publisher` to your Marketplace publisher ID in `package.json`. Then run `npm install` and commit the resulting `package-lock.json`. After that, use `npm ci` on a fresh clone. The extension name and publisher together identify the Marketplace listing; the old local prototype is a separate extension.

```sh
npm ci
npm test
npm run build
```

The build writes `extension.vsix`. Use **Extensions: Install from VSIX** to test it. To debug the extension itself, open the repository root in VS Code and press F5. In the Extension Development Host, open `temperature.js` and run **Zabbix JS Debug: Debug Active Script**. The launch configuration opens `examples` as the workspace, so the sample macros file resolves correctly. For the HTTP example, run `python3 -m http.server 8080 --bind 127.0.0.1 --directory examples/demo-http` from the repository root first.

## Where to make changes

| Module | Responsibility |
| --- | --- |
| `extension.js` | Register the command, select the workspace and delegate the launch. |
| `core.js` | Resolve paths and prepare the script body and input without depending on VS Code. |
| `runner.js` | Run the script body under its original filename inside Node. |
| `api.js` | Expose the selected HTTP and logging API names. |
| `http.js`, `crypto.js` | Synchronous HTTP and binary/cryptographic helpers. |
| `xml.js`, `xml_worker.py` | XPath and XML conversion through libxml2. |
| `macro-panel.js` | Present workspace macro entries without exposing environment secrets. |
| `native-runner.js` | Stream an external process and remove temporary expanded source. |

Use Prettier conventions (two-space indentation, single quotes and semicolons) for JavaScript; use PEP 8 for Python. Install Python 3 and lxml to run the XML tests. Run `npm run format` after editing source code. Put runtime tests in `test/`; verify VS Code UI changes manually in the Extension Development Host. Keep end-user instructions in the root README and release procedures here. All user settings use the case-sensitive `zabbixJsDebug.*` prefix.

## Publish a release

Pull requests and pushes to `main` run tests and package the VSIX. Download the build artifact and smoke-test it before tagging. Configure a GitHub environment named `marketplace` with a secret `VSCE_PAT` (Azure DevOps PAT with Marketplace → Manage and publisher access). Protect release tags and configure environment approval as appropriate. Do not commit tokens.

Set an unpublished version in `package.json`, update the lock file, and commit both. Tag that exact commit `v<version>` and push the tag. The workflow rejects a version mismatch. Only a matching release tag triggers publication of the already built VSIX. See [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for publisher setup.
