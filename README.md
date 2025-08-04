<div align="center">
  <img src="./image/LicenseSentinel.png" alt="License Sentinel" width="220" height="220" />
</div>

<div align="center">
  <h1> License Sentinel 🛡️</h1>
</div>

**Your Project’s Automated Open Source License Guardian for VS Code**

License Sentinel empowers development teams to manage, audit, and enforce open-source license policies directly within Visual Studio Code. It seamlessly integrates into your workflow, providing continuous scanning, real-time insights, and powerful actions to eliminate manual overhead and legal surprises.

---

## 🔍 Features

### 1. Comprehensive Dependency Tree
Click the 🛡️ icon in the Activity Bar to get a clear, organized view of all dependencies across your workspace.
* **Grouped by Manifest**: Dependencies are grouped by their manifest file (e.g., `frontend/package.json`, `backend/pom.xml`), perfect for monorepos.
* **At-a-Glance Status**: Instantly identify the status of each dependency with intuitive icons:
    * ✅ **Compliant**: The license is in your `allowedLicenses` list.
    * ❌ **Non-Compliant**: The license is in your `deniedLicenses` list.
    * ❓ **Unknown**: The license is not in any policy list and requires manual review. An error during fetching may also result in this state.
* **Built-in Filtering**: Use the filter box to quickly find specific dependencies or files.

### 2. Real-Time Editor Insights
Get immediate feedback without leaving your code.
* **Inline Decorations**: License information and compliance status appear directly next to the dependency line in your manifest files.
* **Detailed Hover Information**: Hover over a dependency to see a popup with its name, version, license, status, and a direct link to its homepage.
* **On-Save Analysis**: The extension automatically re-scans a manifest file every time you save it.

### 3. Interactive Status Bar
The status bar provides a persistent, summarized overview of your project's license health.
* **Live Counts**: See the total number of compliant, unknown, and non-compliant dependencies at a glance.
* **Click to Refresh**: Simply click the status bar item to trigger a full workspace scan at any time.

### 4. Powerful Context Menu Actions
Right-click to access powerful commands directly where you need them.
* **In the Tree View**:
    * **Go to File**: Jump directly to the manifest file.
    * **Open Homepage**: Open the dependency's homepage in your browser.
    * **Copy Dependency Info**: Copy all details of a dependency as a JSON object to your clipboard.
    * **Update Policy**: Instantly add a dependency's license to your `allowedLicenses` or `deniedLicenses` in `settings.json`.
* **In the Editor**:
    * Right-click within a supported manifest file to **Start Scan**, **Refresh**, or **Clear Cache & Rescan**.

### 5. Flexible Policy Configuration
Define your organization's license policies in your workspace `settings.json`.
* **Allow & Deny Lists**: Maintain simple arrays of approved or forbidden license identifiers. The check is case-insensitive and supports multi-license strings (e.g., "MIT OR Apache-2.0").
* **Custom Exclusions**: Specify folders to ignore during scanning using glob patterns.

    ```json
    // .vscode/settings.json
    {
      "license-sentinel.allowedLicenses": ["MIT", "Apache-2.0", "BSD-3-Clause"],
      "license-sentinel.deniedLicenses": ["GPL-2.0", "AGPL-3.0", "CC-BY-NC-SA-4.0"],
      "license-sentinel.excludePatterns": [
        "**/node_modules/**",
        "**/target/**",
        "**/build/**",
        "**/testdata/**"
      ]
    }
    ```

### 6. Exportable Reports
Generate comprehensive reports for auditing or documentation.
* **Export to Markdown**: Create a full, human-readable compliance report (`.md`).
* **Export to CSV**: Generate a CSV file of all scanned dependencies and their details, perfect for importing into other tools.

### 7. Caching for Performance
* **Smart Caching**: License Sentinel caches dependency information to provide faster analysis on subsequent scans.
* **Clear Cache**: If you suspect the data is stale or encounter issues, use the `License Sentinel 🛡️: Clear Cache & Rescan` command to fetch fresh data for all dependencies.

### 8. Broad Language Support
License Sentinel is built to handle modern polyglot projects.

| Language              | Manifest File    |     Status    |
| --------------------- | ---------------- | :-----------: |
| JavaScript/TypeScript | `package.json`   |  ✅ Supported  |
| Python (Poetry)       | `pyproject.toml,requirement.txt` |  ✅ Supported  |
| PHP (Composer)        | `composer.json`  |  ✅ Supported  |
| Java (Maven)          | `pom.xml`        |  ✅ Supported  |
| Go                    | `go.mod`         |  ✅ Supported  |
| Rust (Cargo)          | `Cargo.toml`     |  ✅ Supported  |
| Ruby                  | `Gemfile.lock`   | ⏳ Coming Soon |
| .NET (C#)             | `*.csproj`       | ⏳ Coming Soon |

---

## 🛠️ Getting Started

1.  **Install from Marketplace**
    * Open VS Code, go to Extensions (`Ctrl+Shift+X`), search for **License Sentinel**, and click **Install**.

2.  **Configure Your Policies (Optional but Recommended)**
    * Open your workspace `settings.json` file (`Ctrl+Shift+P` → `Preferences: Open Workspace Settings (JSON)`).
    * Add your `license-sentinel.allowedLicenses` and `license-sentinel.deniedLicenses` rules.

3.  **How it Works**
    * License Sentinel scans your workspace automatically upon startup and when you save a supported manifest file.
    * You can trigger a manual scan at any time using:
        * The **Refresh** button in the License Sentinel view.
        * The **Status Bar** item.
        * The right-click **Context Menu** in a manifest file.
        * The Command Palette (`Ctrl+Shift+P` → `LicenseSentinel: Refresh Scan`).

4.  **Review & Resolve**
    * Use the **License Sentinel Activity Bar view** to see a complete list of dependencies and their status.
    * Look for inline decorations and hover over them in your manifest files for quick insights.

---

## 🤝 Contributing

We welcome all contributions—from bug reports and feature requests to pull requests and documentation improvements.

1.  Fork this repository.
2.  Create a feature branch (`git checkout -b feature/YourFeature`).
3.  Commit your changes (`git commit -m 'Add YourFeature'`).
4.  Push to the branch (`git push origin feature/YourFeature`).
5.  Open a Pull Request.

Please follow the [Contributor Guidelines](CONTRIBUTING.md) and ensure all new code is covered by unit tests.

---

## 📄 License

```
MIT License

Copyright (c) 2025 Thirawat Sinlapasomsak

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```