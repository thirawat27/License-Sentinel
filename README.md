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

### 1. Comprehensive & Intelligent Dependency Tree
Click the 🛡️ icon in the Activity Bar to get a clear, organized view of all dependencies across your workspace.
*   **Grouped by Manifest**: Dependencies are grouped by their manifest file (e.g., `frontend/package.json`, `backend/pom.xml`), perfect for monorepos.
*   **At-a-Glance Status**: Instantly identify the status of each dependency with intuitive icons:
    *   ✅ **Compliant**: The license is in your `allowedLicenses` list.
    *   ❌ **Non-Compliant**: The license is in your `deniedLicenses` list or a policy override.
    *   ❓ **Unknown**: The license is not in any policy list and requires manual review. An error during fetching may also result in this state.
*   **Deep Obligation Insights**: Expand a dependency to see its key legal obligations, such as:
    *   $(error) Source code must be disclosed if distributed.
    *   $(warning) Changes to the licensed code must be stated.
    *   $(info) Must include the original copyright notice.

### 2. Real-Time Editor Insights
Get immediate feedback without leaving your code.
*   **Inline Decorations**: License information and compliance status appear directly next to the dependency line in your manifest files.
*   **Detailed Hover Information**: Hover over a dependency to see a popup with its name, version, license, compliance reason, key obligations, and a direct link to its homepage.
*   **On-Save Analysis**: The extension automatically re-scans a manifest file every time you save it.

### 3. Powerful Context Menu Actions
Right-click to access powerful commands directly where you need them.
*   **In the Tree View**:
    *   **Go to File**: Jump directly to the manifest file.
    *   **Open Homepage**: Open the dependency's homepage in your browser.
    *   **Copy Dependency Info**: Copy all details of a dependency as a JSON object.
    *   **Update Policy**: Instantly add a dependency's license to your `allowedLicenses` or `deniedLicenses` in `settings.json`.
*   **In the Editor**:
    *   Right-click within a supported manifest file to **Start Scan**, **Refresh**, or **Clear Cache & Rescan**.

### 4. Flexible & Granular Policy Configuration
Define your organization's license policies in your workspace `.vscode/settings.json`.
*   **Allow & Deny Lists**: Maintain simple arrays of approved or forbidden license identifiers (SPDX).
*   **Exclusion Patterns**: Specify folders to ignore during scanning using glob patterns.
*   **Policy Overrides**: Set specific rules for individual packages, overriding the global policy. This is perfect for handling exceptions approved by your legal team.

    ```json
    // .vscode/settings.json
    {
      "license-sentinel.allowedLicenses": ["MIT", "Apache-2.0", "BSD-3-Clause"],
      "license-sentinel.deniedLicenses": ["AGPL-3.0-only", "GPL-3.0-only", "CC-BY-NC-4.0"],
      "license-sentinel.excludePatterns": [
        "**/node_modules/**",
        "**/target/**",
        "**/build/**"
      ],
      "license-sentinel.policyOverrides": [
        {
          "name": "a-gpl-licensed-package",
          "version": "1.2.3",
          "allow": true,
          "reason": "Approved for internal use only by Legal team."
        }
      ]
    }
    ```

### 5. Exportable Reports & Interactive Status Bar
*   **Export Reports**: Generate comprehensive reports in **Markdown** for human-readable summaries or **CSV** for data analysis.
*   **Status Bar**: Get a persistent overview of your project's license health with live counts (✅ Compliant | ❓ Unknown | ❌ Non-Compliant). Click it anytime to refresh the scan.

### 6. Caching for Performance
*   **Smart Caching**: License Sentinel caches dependency information to provide faster analysis on subsequent scans.
*   **Clear Cache**: Use the `License Sentinel 🛡️: Clear Cache & Rescan` command to fetch fresh data for all dependencies.

### 7. Broad Language Support
License Sentinel is built to handle modern polyglot projects.

| Language              | Manifest File(s)               |     Status    |
| --------------------- | ------------------------------ | :-----------: |
| JavaScript/TypeScript | `package.json`                 |  ✅ Supported  |
| Python                | `pyproject.toml`, `requirements.txt` |  ✅ Supported  |
| PHP (Composer)        | `composer.json`                |  ✅ Supported  |
| Java (Maven)          | `pom.xml`                      |  ✅ Supported  |
| Go                    | `go.mod`                       |  ✅ Supported  |
| Rust (Cargo)          | `Cargo.toml`                   |  ✅ Supported  |
| Ruby                  | `Gemfile.lock`                 | ⏳ Coming Soon |
| .NET (C#)             | `*.csproj`                     | ⏳ Coming Soon |

---

## 🛠️ Getting Started

1.  **Install from Marketplace**
    *   Open VS Code, go to Extensions (`Ctrl+Shift+X`), search for **License Sentinel**, and click **Install**.

2.  **Configure Your Policies (Recommended)**
    *   Open your workspace `settings.json` file (`Ctrl+Shift+P` → `Preferences: Open Workspace Settings (JSON)`).
    *   Add your `license-sentinel.allowedLicenses` and `license-sentinel.deniedLicenses` rules.

3.  **How it Works**
    *   License Sentinel scans your workspace automatically upon startup and when you save a supported manifest file.
    *   You can trigger a manual scan at any time using the **Refresh** button in the License Sentinel view, the **Status Bar** item, or the **Command Palette**.

4.  **Review & Resolve**
    *   Use the **License Sentinel Activity Bar view** to see a complete list of dependencies and their status.
    *   Look for inline decorations and hover over them in your manifest files for quick insights and detailed obligations.

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