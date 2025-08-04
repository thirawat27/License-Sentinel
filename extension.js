// This is the main entry point for the License Sentinel VS Code extension.
// It initializes the extension, registers commands and providers, and sets up event listeners.
const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises');
const { scanWorkspace } = require('./src/core/scanner');
// Import the LicenseTreeDataProvider to display dependencies in a tree view.
const { LicenseTreeDataProvider } = require('./src/features/licenseTreeDataProvider');
// Import the DependencyHoverProvider to show dependency information on hover, and the updateDecorations function to update editor decorations.
const { DependencyHoverProvider, updateDecorations } = require('./src/features/decorations');
// Import utility functions for converting data to CSV format and debouncing function calls.
const { convertToCsv, debounce } = require('./src/utils/text');

// Define constants for all the commands used in the extension.
const COMMANDS = {
    // Command to start a new license scan.
    START_SCAN: 'license-sentinel.startScan',
    // Command to refresh the license scan results.
    REFRESH: 'license-sentinel.refresh',
    // Command to clear the extension's cache.
    CLEAR_CACHE: 'license-sentinel.clearCache',
    // Command to export the license report.
    EXPORT_REPORT: 'license-sentinel.exportReport',
    // Command to navigate to the manifest file of a dependency.
    GO_TO_FILE: 'license-sentinel.goToManifestFile',
    // Command to open the homepage of a dependency.
    OPEN_HOMEPAGE: 'license-sentinel.openHomepage',
    // Command to copy dependency information to the clipboard.
    COPY_INFO: 'license-sentinel.copyDependencyInfo',
    // Command to add a license to the list of allowed licenses.
    ADD_ALLOWED: 'license-sentinel.addAllowedLicense',
    // Command to add a license to the list of denied licenses.
    ADD_DENIED: 'license-sentinel.addDeniedLicense',
    // Command to open the extension's settings.
    OPEN_SETTINGS: 'license-sentinel.openSettings',
};

// Store the dependency data obtained from the workspace scan.
let dependencyData = [];
// Track whether the extension has been activated.
let isActivated = false;
// Store references to the UI managers (tree data provider, hover provider, status bar item).
let uiManagers = {};
// Diagnostic collection to manage and display problems in the VS Code editor.
let diagnosticCollection;

// This function is called when the extension is activated.
async function activate(context) {
    // Prevent multiple activations.
    if (isActivated) return;
    isActivated = true;
    console.log('LicenseSentinel is now active!');

    // Create a diagnostic collection to highlight license issues in the editor.
    diagnosticCollection = vscode.languages.createDiagnosticCollection('license-sentinel');
    context.subscriptions.push(diagnosticCollection);

    // Create a new LicenseTreeDataProvider and register it with VS Code to display the dependency tree view.
    const treeDataProvider = new LicenseTreeDataProvider();
    vscode.window.createTreeView('license-sentinel-dependency-view', { treeDataProvider, showCollapseAll: true });

    // Create a new DependencyHoverProvider and register it with VS Code to provide hover information for dependencies.
    const hoverProvider = new DependencyHoverProvider();
    // Create a status bar item to display the current status of the license scan.
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = COMMANDS.REFRESH;
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // Store the UI managers for easy access.
    uiManagers = { treeDataProvider, hoverProvider, statusBarItem };

    // Register all the commands used by the extension.
    registerCommands(context);
    // Register the providers for hover information and code actions.
    registerProviders(context);
    // Set up event listeners for workspace changes, document saves, and configuration changes.
    setupEventListeners(context);

    // Run an initial scan of the workspace when the extension is activated.
    runScan(context);
}

// This function registers all the commands used by the extension.
function registerCommands(context) {
    // Register the start scan command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.START_SCAN, () => runScan(context)));
    // Register the refresh command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.REFRESH, () => runScan(context)));

    // Register the clear cache command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.CLEAR_CACHE, () => {
        // Get all the keys in the workspace state that start with 'license-sentinel:'.
        const keysToClear = context.workspaceState.keys().filter(key => key.startsWith('license-sentinel:'));
        // Create an array of promises to update each key to undefined.
        const promises = keysToClear.map(key => context.workspaceState.update(key, undefined));
        // Wait for all the promises to resolve, then show a message and run a new scan.
        Promise.all(promises).then(() => {
            vscode.window.showInformationMessage('LicenseSentinel cache cleared! Starting a new scan...');
            runScan(context);
        });
    }));

    // Register the export report command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.EXPORT_REPORT, () => exportReport()));

    // Register the go to file command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.GO_TO_FILE, (item) => {
        // If the item is a TreeItem and has a resource URI, open the corresponding document in the editor.
        if (item instanceof vscode.TreeItem && item.resourceUri) {
            vscode.window.showTextDocument(item.resourceUri);
        }
    }));

    // Register the open homepage command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.OPEN_HOMEPAGE, (item) => {
        // If the item has dependency information and a homepage URL, open the URL in the user's default browser.
        if (item && item.dependencyInfo && item.dependencyInfo.homepage) {
            vscode.env.openExternal(vscode.Uri.parse(item.dependencyInfo.homepage));
        }
    }));

    // Register the copy info command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.COPY_INFO, (item) => {
        // If the item has dependency information, copy it to the clipboard.
        if (item && item.dependencyInfo) {
            // Copy a cleaner version of the info
            const infoToCopy = {
                name: item.dependencyInfo.name,
                version: item.dependencyInfo.version,
                license: item.dependencyInfo.license,
                status: item.dependencyInfo.status,
                homepage: item.dependencyInfo.homepage,
                reason: item.dependencyInfo.analysis.reason
            };
            vscode.env.clipboard.writeText(JSON.stringify(infoToCopy, null, 2));
            vscode.window.showInformationMessage(`Copied info for ${item.dependencyInfo.name} to clipboard.`);
        }
    }));

    // Register the add allowed command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.ADD_ALLOWED, (item) => {
        // If the item has dependency information, add the license to the list of allowed licenses.
        if (item && item.dependencyInfo) {
            updateLicensePolicy('allowedLicenses', item.dependencyInfo.license, context);
        }
    }));

    // Register the add denied command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.ADD_DENIED, (item) => {
        // If the item has dependency information, add the license to the list of denied licenses.
        if (item && item.dependencyInfo) {
            updateLicensePolicy('deniedLicenses', item.dependencyInfo.license, context);
        }
    }));

    // Register the open settings command.
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.OPEN_SETTINGS, () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'license-sentinel');
    }));
}

// This function registers the providers for hover information and code actions.
function registerProviders(context) {
    // Define the languages for which to provide hover information and code actions.
    const supportedLanguages = [
        'json',
        'jsonc',
        'toml',
        'xml',
        { scheme: 'file', language: 'go.mod' },
        'pip-requirements'
    ];

    // Register the hover provider.
    context.subscriptions.push(vscode.languages.registerHoverProvider(
        supportedLanguages,
        uiManagers.hoverProvider
    ));

    // Register the code actions provider.
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
        supportedLanguages,
        new LicenseActionProvider(),
        { providedCodeActionKinds: LicenseActionProvider.providedCodeActionKinds }
    ));
}

// This function sets up event listeners for workspace changes, document saves, and configuration changes.
function setupEventListeners(context) {
    // Create a debounced function to update the UI.
    const debouncedUpdateAllUI = debounce(() => updateAllUI(dependencyData), 500);

    // Watch for changes to the settings.json file and trigger a scan when it's saved.
    const onSaveWatcher = vscode.workspace.onDidSaveTextDocument(doc => {
        const supportedFiles = [
            'package.json',
            'composer.json',
            'pyproject.toml',
            'pom.xml',
            'go.mod',
            'Cargo.toml',
            'requirements.txt'
        ];
        if (supportedFiles.some(f => doc.fileName.endsWith(f)) || doc.fileName.endsWith('settings.json')) {
            runScan(context);
        }
    });

    // Watch for the active editor to change and update the decorations accordingly.
    const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDecorations(editor, dependencyData);
        }
    });

    // Watch for configuration changes and trigger a scan when the extension's configuration is changed.
    const onConfigChange = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('license-sentinel')) {
            runScan(context);
        }
    });

    // Add the event listeners to the context so they are disposed of when the extension is deactivated.
    context.subscriptions.push(onSaveWatcher, onActiveEditorChange, onConfigChange);
}

// This function runs a scan of the workspace for dependencies and their licenses.
async function runScan(context) {
    const { statusBarItem } = uiManagers;
    // Update the status bar to indicate that a scan is in progress.
    statusBarItem.text = `$(sync~spin) License Scan`;
    statusBarItem.tooltip = 'LicenseSentinel is scanning your workspace...';

    // Show a progress notification while the scan is running.
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "LicenseSentinel: Scanning dependencies...",
        cancellable: false
    }, async (progress) => {
        // Scan the workspace for dependencies and their licenses.
        dependencyData = await scanWorkspace(context, progress);
        // Update the UI with the new dependency data.
        updateAllUI(dependencyData);
    });
}

// This function updates all the UI elements with the given dependency data.
function updateAllUI(deps) {
    const { treeDataProvider, hoverProvider, statusBarItem } = uiManagers;

    // Refresh the dependency tree view.
    treeDataProvider.refresh(deps);
    // Update the hover provider with the new dependency data.
    hoverProvider.updateData(deps);
    // Update the status bar with the new dependency data.
    updateStatusBar(statusBarItem);

    // If there is an active text editor, update the decorations.
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor, deps);
    }

    // Update the diagnostics with the new dependency data.
    updateDiagnostics(deps);
}

// This function updates the diagnostics with the given dependency data.
function updateDiagnostics(deps) {
    // Clear the existing diagnostics.
    diagnosticCollection.clear();
    // Create a map to store the diagnostics for each file.
    const diagnosticsByFile = new Map();

    // Iterate over the dependencies.
    for (const dep of deps) {
        // If the dependency is compliant or the line number is not available, skip it.
        if (dep.status === 'compliant' || typeof dep.line !== 'number') continue;

        // Get the file URI for the dependency's manifest file.
        const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, dep.manifestFile);

        // Use the line number directly from the dependency data
        const range = new vscode.Range(dep.line, 0, dep.line, 100);

        // Determine the severity of the diagnostic based on the dependency's status.
        const severity = dep.status === 'non-compliant' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
        // Create a new diagnostic.
        const diagnostic = new vscode.Diagnostic(range, dep.analysis.reason, severity);
        diagnostic.source = 'LicenseSentinel';
        diagnostic.code = `${dep.license}|${dep.name}`;

        // If the file URI is not already in the map, add it.
        if (!diagnosticsByFile.has(fileUri.path)) {
            diagnosticsByFile.set(fileUri.path, { uri: fileUri, diags: [] });
        }
        // Add the diagnostic to the list of diagnostics for the file.
        diagnosticsByFile.get(fileUri.path).diags.push(diagnostic);
    }

    // Iterate over the diagnostics by file.
    for (const [_, { uri, diags }] of diagnosticsByFile) {
        // Set the diagnostics for the file.
        diagnosticCollection.set(uri, diags);
    }
}

// This class provides code actions for license issues.
class LicenseActionProvider {
    // Define the code action kinds that this provider can provide.
    static providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    // This function provides code actions for the given document and range.
    provideCodeActions(document, range, context, token) {
        // Filter the diagnostics to only include those from LicenseSentinel.
        return context.diagnostics
            .filter(diag => diag.source === 'LicenseSentinel')
            // Create actions for each diagnostic.
            .flatMap(diag => this.createActionsForDiagnostic(diag));
    }

    // This function creates code actions for the given diagnostic.
    createActionsForDiagnostic(diagnostic) {
        // Split the diagnostic code into the license string and the dependency name.
        const [licenseString, depName] = diagnostic.code.split('|');
        // If the license string is invalid, return an empty array.
        if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) return [];

        // Split the license string into individual licenses.
        const licenses = licenseString.split(/ OR |\/|\sOR\s/i).map(l => l.trim()).filter(Boolean);
        // If there are no licenses, return an empty array.
        if (licenses.length === 0) return [];

        // Create an array to store the code actions.
        const actions = [];
        // Get the unique licenses.
        const uniqueLicenses = [...new Set(licenses)];

        // Create a code action to allow the license.
        const allowAction = new vscode.CodeAction(`Allow license(s): "${uniqueLicenses.join(', ')}"`, vscode.CodeActionKind.QuickFix);
        allowAction.command = {
            command: COMMANDS.ADD_ALLOWED,
            title: `Allow License(s): ${uniqueLicenses.join(', ')}`,
            arguments: [{ dependencyInfo: { license: licenseString, name: depName } }]
        };
        allowAction.diagnostics = [diagnostic];
        allowAction.isPreferred = true;
        actions.push(allowAction);

        // Create a code action to deny the license.
        const denyAction = new vscode.CodeAction(`Deny license(s): "${uniqueLicenses.join(', ')}"`, vscode.CodeActionKind.QuickFix);
        denyAction.command = {
            command: COMMANDS.ADD_DENIED,
            title: `Deny License(s): ${uniqueLicenses.join(', ')}`,
            arguments: [{ dependencyInfo: { license: licenseString, name: depName } }]
        };
        denyAction.diagnostics = [diagnostic];
        actions.push(denyAction);

        // Return the code actions.
        return actions;
    }
}

// This function updates the license policy settings.
async function updateLicensePolicy(policyType, licenseString, context) {
    // If the license string is invalid, show a warning message and return.
    if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) {
        vscode.window.showWarningMessage('Cannot add an invalid license to the policy.');
        return;
    }

    // Get the current license policies from the configuration.
    const config = vscode.workspace.getConfiguration('license-sentinel');
    const currentPolicies = new Set(config.get(policyType, []).map(l => String(l).toLowerCase()));

    // Split the license string into individual licenses.
    const licensesToAdd = licenseString.split(/ OR |\/|\sOR\s/i).map(l => l.trim()).filter(Boolean);
    let added = false;
    let addedList = [];

    // Iterate over the licenses to add.
    for (const license of licensesToAdd) {
        // If the license is not already in the policy, add it.
        if (license && !currentPolicies.has(license.toLowerCase())) {
            addedList.push(license);
            added = true;
        }
    }

    // If no licenses were added, show an information message and return.
    if (!added) {
        vscode.window.showInformationMessage(`License(s) in "${licenseString}" are already covered by your policies.`);
        return;
    }

    // Add the new licenses to the policy.
    const newPolicies = [...config.get(policyType, []), ...addedList].sort((a, b) => a.localeCompare(b));

    // Update the configuration with the new policy.
    await config.update(policyType, newPolicies, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`Policies updated. Your workspace settings.json was modified.`);
}

// This function updates the status bar with the current license information.
function updateStatusBar(statusBarItem) {
    // Count the number of compliant, non-compliant, and unknown dependencies.
    const compliantCount = dependencyData.filter(d => d.status === 'compliant').length;
    const nonCompliantCount = dependencyData.filter(d => d.status === 'non-compliant').length;
    const unknownCount = dependencyData.filter(d => d.status === 'unknown').length;

    // Update the status bar text with the counts.
    statusBarItem.text = `$(check) ${compliantCount} | $(warning) ${unknownCount} | $(error) ${nonCompliantCount}`;
    statusBarItem.tooltip = `LicenseSentinel: ${compliantCount} compliant, ${unknownCount} unknown, ${nonCompliantCount} non-compliant. Click to refresh.`;

    // If there are non-compliant dependencies, change the background color of the status bar item to red.
    if (nonCompliantCount > 0) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        statusBarItem.backgroundColor = undefined;
    }
}

// This function exports the license report to a file.
async function exportReport() {
    // If there is no dependency data, show an information message and return.
    if (dependencyData.length === 0) {
        vscode.window.showInformationMessage('No data to export. Run a scan first.');
        return;
    }

    // Prompt the user to choose an export format.
    const choice = await vscode.window.showQuickPick(
        [
            { label: 'Markdown Report', description: 'Export a full, human-readable compliance report (.md)', format: 'md' },
            { label: 'CSV Data', description: 'Export raw dependency data as a CSV file (.csv)', format: 'csv' }
        ],
        { placeHolder: 'Choose an export format' }
    );

    // If the user chose an export format, export the report.
    if (choice) {
        if (choice.format === 'md') {
            await _exportAsMarkdown();
        } else if (choice.format === 'csv') {
            await _exportAsCsv();
        }
    }
}

// This function exports the license report as a CSV file.
async function _exportAsCsv() {
    try {
        // Map the dependency data to a format suitable for CSV export.
        const csvData = dependencyData.map(dep => ({
            name: dep.name,
            version: dep.version,
            license: dep.license,
            status: dep.status,
            homepage: dep.homepage,
            source: dep.manifestFile,
            reason: dep.analysis.reason.replace(/,/g, ';'), // Avoid commas in reason
        }));
        // Convert the data to CSV format.
        const csvContent = convertToCsv(csvData);
        // Get the workspace folder.
        const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined;
        // Set the default URI for the save dialog.
        const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder, 'license-report.csv') : undefined;
        // Prompt the user to choose a location to save the file.
        const uri = await vscode.window.showSaveDialog({ defaultUri, filters: { 'CSV files': ['csv'] } });
        // If the user chose a location, save the file.
        if (uri) {
            await fs.writeFile(uri.fsPath, csvContent, 'utf8');
            vscode.window.showInformationMessage(`CSV report saved to ${path.basename(uri.fsPath)}`);
        }
    } catch (error) {
        // If there was an error, show an error message.
        vscode.window.showErrorMessage('Failed to export CSV report.');
        console.error(error);
    }
}

// This function exports the license report as a Markdown file.
async function _exportAsMarkdown() {
    // Filter the dependencies by status.
    const nonCompliantDeps = dependencyData.filter(d => d.status === 'non-compliant');
    const unknownDeps = dependencyData.filter(d => d.status === 'unknown');
    const compliantCount = dependencyData.length - nonCompliantDeps.length - unknownDeps.length;

    // Create the Markdown report.
    let report = `# 🛡️ License Sentinel - Compliance Report\n\n`;
    report += `**Generated:** ${new Date().toUTCString()}\n\n`;
    report += `## 📊 Summary\n\n`;
    report += `| Status | Count |\n| :--- | :---: |\n`;
    report += `| ✅ Compliant | ${compliantCount} |\n`;
    report += `| ❓ Unknown | ${unknownDeps.length} |\n`;
    report += `| ❌ Non-Compliant | ${nonCompliantDeps.length} |\n\n`;

    // Add the non-compliant dependencies to the report.
    if (nonCompliantDeps.length > 0) {
        report += `## ❌ Non-Compliant Dependencies (${nonCompliantDeps.length})\n\n`;
        report += `These dependencies have licenses that are explicitly forbidden by your project's policy or have been marked as non-compliant by an override.\n\n`;
        report += `| Package | Version | License | Reason |\n| :--- | :--- | :--- | :--- |\n`;
        nonCompliantDeps.forEach(d => {
            report += `| \`${d.name}\` | \`${d.version}\` | \`${d.license}\` | ${d.analysis.reason} |\n`;
        });
    }

    // Add the unknown dependencies to the report.
    if (unknownDeps.length > 0) {
        report += `\n## ❓ Unknown Status Dependencies (${unknownDeps.length})\n\n`;
        report += `These dependencies have licenses that are not on your allowed or denied lists. Manual review is required.\n\n`;
        report += `| Package | Version | License | Source File |\n| :--- | :--- | :--- | :--- |\n`;
        unknownDeps.forEach(d => {
            report += `| \`${d.name}\` | \`${d.version}\` | \`${d.license}\` | \`${d.manifestFile}\` |\n`;
        });
    }

    // Open the report in a new editor window.
    const doc = await vscode.workspace.openTextDocument({ content: report, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
}

// This function is called when the extension is deactivated.
function deactivate() {
    isActivated = false;
    // Dispose of the diagnostic collection.
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

// Export the activate and deactivate functions.
module.exports = { activate, deactivate };