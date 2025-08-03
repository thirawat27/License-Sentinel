const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises');
const { scanWorkspace } = require('./src/core/scanner');
const { LicenseTreeDataProvider } = require('./src/provider/licenseTreeDataProvider');
const { DependencyHoverProvider, updateDecorations } = require('./src/features/decorations');
const { convertToCsv, debounce } = require('./src/utils/text');

// Global state to hold the latest dependency data
let dependencyData = [];
let isActivated = false;

/**
 * Main activation function for the extension.
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    if (isActivated) {
        return;
    }
    isActivated = true;

    console.log('LicenseSentinel is now active!');

    // 1. Setup UI Providers
    const treeDataProvider = new LicenseTreeDataProvider();
    vscode.window.createTreeView('license-sentinel-dependency-view', { treeDataProvider, showCollapseAll: true });

    const hoverProvider = new DependencyHoverProvider();
    context.subscriptions.push(vscode.languages.registerHoverProvider(
        ['json', 'jsonc', 'toml', 'xml', { scheme: 'file', language: 'go.mod' }],
        hoverProvider
    ));

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'license-sentinel.refresh';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // 2. Register Commands
    const refreshCommand = vscode.commands.registerCommand('license-sentinel.refresh',
        () => runScan(context, treeDataProvider, hoverProvider, statusBarItem)
    );
    const clearCacheCommand = vscode.commands.registerCommand('license-sentinel.clearCache', () => {
        const keysToClear = context.workspaceState.keys().filter(key => key.startsWith('license-sentinel:'));
        const promises = keysToClear.map(key => context.workspaceState.update(key, undefined));
        Promise.all(promises).then(() => {
            vscode.window.showInformationMessage('LicenseSentinel cache cleared!');
            vscode.commands.executeCommand('license-sentinel.refresh');
        });
    });
    const exportCsvCommand = vscode.commands.registerCommand('license-sentinel.exportCsv', () => exportDataAsCsv());

    context.subscriptions.push(refreshCommand, clearCacheCommand, exportCsvCommand);

    // 3. Setup Automation and Event Listeners
    const debouncedUpdateDecorations = debounce((editor) => {
        if (editor) {
            updateDecorations(editor, dependencyData);
        }
    }, 500);

    const onSaveWatcher = vscode.workspace.onDidSaveTextDocument(doc => {
        const supportedFiles = ['package.json', 'composer.json', 'pyproject.toml', 'pom.xml', 'go.mod', 'Cargo.toml'];
        if (supportedFiles.includes(path.basename(doc.fileName))) {
            runScan(context, treeDataProvider, hoverProvider, statusBarItem);
        }
    });

    const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
        debouncedUpdateDecorations(editor);
    });
    
    // Initial decoration update
    if (vscode.window.activeTextEditor) {
        debouncedUpdateDecorations(vscode.window.activeTextEditor);
    }

    context.subscriptions.push(onSaveWatcher, onActiveEditorChange);

    // 4. Initial scan on activation
    runScan(context, treeDataProvider, hoverProvider, statusBarItem);
}

/**
 * Central function to orchestrate scanning and UI updates.
 * @param {vscode.ExtensionContext} context
 * @param {LicenseTreeDataProvider} treeDataProvider
 * @param {DependencyHoverProvider} hoverProvider
 * @param {vscode.StatusBarItem} statusBarItem
 */
async function runScan(context, treeDataProvider, hoverProvider, statusBarItem) {
    statusBarItem.text = `$(sync~spin) License Scan`;
    statusBarItem.tooltip = 'LicenseSentinel is scanning your workspace for dependencies.';
    statusBarItem.backgroundColor = undefined;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "LicenseSentinel: Scanning dependencies...",
        cancellable: false
    }, async (progress) => {
        dependencyData = await scanWorkspace(context, progress);

        treeDataProvider.refresh(dependencyData);
        hoverProvider.updateData(dependencyData);
        if (vscode.window.activeTextEditor) {
            updateDecorations(vscode.window.activeTextEditor, dependencyData);
        }

        updateStatusBar(statusBarItem);
    });
}

/**
 * Updates the status bar item with the scan results.
 * @param {vscode.StatusBarItem} statusBarItem
 */
function updateStatusBar(statusBarItem) {
    const compliantCount = dependencyData.filter(d => d.status === 'compliant').length;
    const nonCompliantCount = dependencyData.filter(d => d.status === 'non-compliant').length;
    const unknownCount = dependencyData.filter(d => d.status === 'unknown' || d.license === 'Error').length;
    const totalCount = dependencyData.length;

    if (totalCount === 0) {
        statusBarItem.text = `$(shield) LicenseSentinel`;
        statusBarItem.tooltip = `LicenseSentinel: No dependencies found.`;
        statusBarItem.backgroundColor = undefined;
        return;
    }

    statusBarItem.text = `$(check) ${compliantCount} | $(question) ${unknownCount} | $(error) ${nonCompliantCount}`;
    statusBarItem.tooltip = `LicenseSentinel (${totalCount} total):\n- Compliant: ${compliantCount}\n- Unknown: ${unknownCount}\n- Non-Compliant: ${nonCompliantCount}\n\nClick to refresh.`;

    if (nonCompliantCount > 0) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        statusBarItem.backgroundColor = undefined; // Reset to default
    }
}

/**
 * Exports the current dependency data to a CSV file.
 */
async function exportDataAsCsv() {
    if (dependencyData.length === 0) {
        vscode.window.showInformationMessage('No dependency data to export. Please run a scan first.');
        return;
    }

    try {
        const csvContent = convertToCsv(dependencyData);
        const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined;
        const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder, 'license-report.csv') : undefined;

        const uri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'CSV files': ['csv'] }
        });

        if (uri) {
            await fs.writeFile(uri.fsPath, csvContent, 'utf8');
            const choice = await vscode.window.showInformationMessage(`Report saved to ${path.basename(uri.fsPath)}`, 'Open File');
            if (choice === 'Open File') {
                vscode.window.showTextDocument(uri);
            }
        }
    } catch (error) {
        console.error("Failed to export CSV:", error);
        vscode.window.showErrorMessage("Failed to export data as CSV. See developer console for details.");
    }
}

function deactivate() {
    isActivated = false;
    console.log('LicenseSentinel has been deactivated.');
}

module.exports = {
    activate,
    deactivate
};