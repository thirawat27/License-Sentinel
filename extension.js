// --- START OF FILE extension.js (FINAL) ---

// This is the main file for the License Sentinel VS Code extension.
// นี่คือไฟล์หลักสำหรับส่วนขยาย License Sentinel VS Code
const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises');
const { scanWorkspace } = require('./src/core/scanner');
// --- FIX: Correct path to licenseTreeDataProvider ---
const { LicenseTreeDataProvider } = require('./src/features/licenseTreeDataProvider'); 
const { DependencyHoverProvider, updateDecorations } = require('./src/features/decorations');
const { convertToCsv, debounce } = require('./src/utils/text');


// --- CONSTANTS ---
const COMMANDS = {
    START_SCAN: 'license-sentinel.startScan',
    REFRESH: 'license-sentinel.refresh',
    CLEAR_CACHE: 'license-sentinel.clearCache',
    EXPORT_REPORT: 'license-sentinel.exportReport',
    GO_TO_FILE: 'license-sentinel.goToManifestFile',
    OPEN_HOMEPAGE: 'license-sentinel.openHomepage',
    COPY_INFO: 'license-sentinel.copyDependencyInfo',
    ADD_ALLOWED: 'license-sentinel.addAllowedLicense',
    ADD_DENIED: 'license-sentinel.addDeniedLicense',
    OPEN_SETTINGS: 'license-sentinel.openSettings',
};
// --- END CONSTANTS ---

let dependencyData = [];
let isActivated = false;
let uiManagers = {};
let diagnosticCollection;

async function activate(context) {
    if (isActivated) return;
    isActivated = true;
    console.log('LicenseSentinel is now active!');

    diagnosticCollection = vscode.languages.createDiagnosticCollection('license-sentinel');
    context.subscriptions.push(diagnosticCollection);

    const treeDataProvider = new LicenseTreeDataProvider();
    vscode.window.createTreeView('license-sentinel-dependency-view', { treeDataProvider, showCollapseAll: true });

    const hoverProvider = new DependencyHoverProvider();
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = COMMANDS.REFRESH;
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    uiManagers = { treeDataProvider, hoverProvider, statusBarItem };

    registerCommands(context);
    registerProviders(context);
    setupEventListeners(context);

    runScan(context);
}

function registerCommands(context) {
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.START_SCAN, () => runScan(context)));
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.REFRESH, () => runScan(context)));
    
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.CLEAR_CACHE, () => {
        const keysToClear = context.workspaceState.keys().filter(key => key.startsWith('license-sentinel:'));
        const promises = keysToClear.map(key => context.workspaceState.update(key, undefined));
        Promise.all(promises).then(() => {
            vscode.window.showInformationMessage('LicenseSentinel cache cleared! Starting a new scan...');
            runScan(context);
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.EXPORT_REPORT, () => exportReport()));

    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.GO_TO_FILE, (item) => {
        if (item instanceof vscode.TreeItem && item.resourceUri) {
            vscode.window.showTextDocument(item.resourceUri);
        }
    }));
    
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.OPEN_HOMEPAGE, (item) => {
        if (item && item.dependencyInfo && item.dependencyInfo.homepage) {
            vscode.env.openExternal(vscode.Uri.parse(item.dependencyInfo.homepage));
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.COPY_INFO, (item) => {
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

    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.ADD_ALLOWED, (item) => {
        if (item && item.dependencyInfo) {
            updateLicensePolicy('allowedLicenses', item.dependencyInfo.license, context);
        }
    }));
    
    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.ADD_DENIED, (item) => {
        if (item && item.dependencyInfo) {
            updateLicensePolicy('deniedLicenses', item.dependencyInfo.license, context);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.OPEN_SETTINGS, () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'license-sentinel');
    }));
}

function registerProviders(context) {
    const supportedLanguages = [
        'json', 
        'jsonc', 
        'toml', 
        'xml', 
        { scheme: 'file', language: 'go.mod' },
        'pip-requirements'
    ];
    
    context.subscriptions.push(vscode.languages.registerHoverProvider(
        supportedLanguages, 
        uiManagers.hoverProvider
    ));
    
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
        supportedLanguages,
        new LicenseActionProvider(),
        { providedCodeActionKinds: LicenseActionProvider.providedCodeActionKinds }
    ));
}

function setupEventListeners(context) {
    const debouncedUpdateAllUI = debounce(() => updateAllUI(dependencyData), 500);

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

    const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDecorations(editor, dependencyData);
        }
    });

    const onConfigChange = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('license-sentinel')) {
            runScan(context);
        }
    });
    
    context.subscriptions.push(onSaveWatcher, onActiveEditorChange, onConfigChange);
}

async function runScan(context) {
    const { statusBarItem } = uiManagers;
    statusBarItem.text = `$(sync~spin) License Scan`;
    statusBarItem.tooltip = 'LicenseSentinel is scanning your workspace...';
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "LicenseSentinel: Scanning dependencies...",
        cancellable: false
    }, async (progress) => {
        dependencyData = await scanWorkspace(context, progress);
        updateAllUI(dependencyData);
    });
}

function updateAllUI(deps) {
    const { treeDataProvider, hoverProvider, statusBarItem } = uiManagers;
    
    treeDataProvider.refresh(deps);
    hoverProvider.updateData(deps);
    updateStatusBar(statusBarItem);

    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor, deps);
    }
    
    updateDiagnostics(deps);
}

function updateDiagnostics(deps) {
    diagnosticCollection.clear();
    const diagnosticsByFile = new Map();

    for (const dep of deps) {
        if (dep.status === 'compliant' || typeof dep.line !== 'number') continue;

        const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, dep.manifestFile);
        
        // Use the line number directly from the dependency data
        const range = new vscode.Range(dep.line, 0, dep.line, 100);
        
        const severity = dep.status === 'non-compliant' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
        const diagnostic = new vscode.Diagnostic(range, dep.analysis.reason, severity);
        diagnostic.source = 'LicenseSentinel';
        diagnostic.code = `${dep.license}|${dep.name}`;

        if (!diagnosticsByFile.has(fileUri.path)) {
            diagnosticsByFile.set(fileUri.path, { uri: fileUri, diags: [] });
        }
        diagnosticsByFile.get(fileUri.path).diags.push(diagnostic);
    }
    
    for (const [_, { uri, diags }] of diagnosticsByFile) {
        diagnosticCollection.set(uri, diags);
    }
}

class LicenseActionProvider {
    static providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    provideCodeActions(document, range, context, token) {
        return context.diagnostics
            .filter(diag => diag.source === 'LicenseSentinel')
            .flatMap(diag => this.createActionsForDiagnostic(diag));
    }

    createActionsForDiagnostic(diagnostic) {
        const [licenseString, depName] = diagnostic.code.split('|');
        if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) return [];

        const licenses = licenseString.split(/ OR |\/|\sOR\s/i).map(l => l.trim()).filter(Boolean);
        if (licenses.length === 0) return [];

        const actions = [];
        const uniqueLicenses = [...new Set(licenses)];

        const allowAction = new vscode.CodeAction(`Allow license(s): "${uniqueLicenses.join(', ')}"`, vscode.CodeActionKind.QuickFix);
        allowAction.command = { 
            command: COMMANDS.ADD_ALLOWED, 
            title: `Allow License(s): ${uniqueLicenses.join(', ')}`,
            arguments: [{ dependencyInfo: { license: licenseString, name: depName } }]
        };
        allowAction.diagnostics = [diagnostic];
        allowAction.isPreferred = true;
        actions.push(allowAction);

        const denyAction = new vscode.CodeAction(`Deny license(s): "${uniqueLicenses.join(', ')}"`, vscode.CodeActionKind.QuickFix);
        denyAction.command = {
            command: COMMANDS.ADD_DENIED,
            title: `Deny License(s): ${uniqueLicenses.join(', ')}`,
            arguments: [{ dependencyInfo: { license: licenseString, name: depName } }]
        };
        denyAction.diagnostics = [diagnostic];
        actions.push(denyAction);

        return actions;
    }
}

async function updateLicensePolicy(policyType, licenseString, context) {
    if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) {
        vscode.window.showWarningMessage('Cannot add an invalid license to the policy.');
        return;
    }

    const config = vscode.workspace.getConfiguration('license-sentinel');
    const currentPolicies = new Set(config.get(policyType, []).map(l => String(l).toLowerCase()));
    
    const licensesToAdd = licenseString.split(/ OR |\/|\sOR\s/i).map(l => l.trim()).filter(Boolean);
    let added = false;
    let addedList = [];
    
    for (const license of licensesToAdd) {
        if (license && !currentPolicies.has(license.toLowerCase())) {
            addedList.push(license);
            added = true;
        }
    }
    
    if (!added) {
        vscode.window.showInformationMessage(`License(s) in "${licenseString}" are already covered by your policies.`);
        return;
    }

    const newPolicies = [...config.get(policyType, []), ...addedList].sort((a,b) => a.localeCompare(b));

    await config.update(policyType, newPolicies, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`Policies updated. Your workspace settings.json was modified.`);
}

function updateStatusBar(statusBarItem) {
    const compliantCount = dependencyData.filter(d => d.status === 'compliant').length;
    const nonCompliantCount = dependencyData.filter(d => d.status === 'non-compliant').length;
    const unknownCount = dependencyData.filter(d => d.status === 'unknown').length;

    statusBarItem.text = `$(check) ${compliantCount} | $(warning) ${unknownCount} | $(error) ${nonCompliantCount}`;
    statusBarItem.tooltip = `LicenseSentinel: ${compliantCount} compliant, ${unknownCount} unknown, ${nonCompliantCount} non-compliant. Click to refresh.`;

    if (nonCompliantCount > 0) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        statusBarItem.backgroundColor = undefined;
    }
}

async function exportReport() {
    if (dependencyData.length === 0) {
        vscode.window.showInformationMessage('No data to export. Run a scan first.');
        return;
    }

    const choice = await vscode.window.showQuickPick(
        [
            { label: 'Markdown Report', description: 'Export a full, human-readable compliance report (.md)', format: 'md' },
            { label: 'CSV Data', description: 'Export raw dependency data as a CSV file (.csv)', format: 'csv' }
        ],
        { placeHolder: 'Choose an export format' }
    );

    if (choice) {
        if (choice.format === 'md') {
            await _exportAsMarkdown();
        } else if (choice.format === 'csv') {
            await _exportAsCsv();
        }
    }
}

async function _exportAsCsv() {
    try {
        const csvData = dependencyData.map(dep => ({
            name: dep.name,
            version: dep.version,
            license: dep.license,
            status: dep.status,
            homepage: dep.homepage,
            source: dep.manifestFile,
            reason: dep.analysis.reason.replace(/,/g, ';'), // Avoid commas in reason
        }));
        const csvContent = convertToCsv(csvData);
        const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined;
        const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder, 'license-report.csv') : undefined;
        const uri = await vscode.window.showSaveDialog({ defaultUri, filters: { 'CSV files': ['csv'] } });
        if (uri) {
            await fs.writeFile(uri.fsPath, csvContent, 'utf8');
            vscode.window.showInformationMessage(`CSV report saved to ${path.basename(uri.fsPath)}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage('Failed to export CSV report.');
        console.error(error);
    }
}

async function _exportAsMarkdown() {
    const nonCompliantDeps = dependencyData.filter(d => d.status === 'non-compliant');
    const unknownDeps = dependencyData.filter(d => d.status === 'unknown');
    const compliantCount = dependencyData.length - nonCompliantDeps.length - unknownDeps.length;
    
    let report = `# 🛡️ License Sentinel - Compliance Report\n\n`;
    report += `**Generated:** ${new Date().toUTCString()}\n\n`;
    report += `## 📊 Summary\n\n`;
    report += `| Status | Count |\n| :--- | :---: |\n`;
    report += `| ✅ Compliant | ${compliantCount} |\n`;
    report += `| ❓ Unknown | ${unknownDeps.length} |\n`;
    report += `| ❌ Non-Compliant | ${nonCompliantDeps.length} |\n\n`;

    if (nonCompliantDeps.length > 0) {
        report += `## ❌ Non-Compliant Dependencies (${nonCompliantDeps.length})\n\n`;
        report += `These dependencies have licenses that are explicitly forbidden by your project's policy or have been marked as non-compliant by an override.\n\n`;
        report += `| Package | Version | License | Reason |\n| :--- | :--- | :--- | :--- |\n`;
        nonCompliantDeps.forEach(d => {
            report += `| \`${d.name}\` | \`${d.version}\` | \`${d.license}\` | ${d.analysis.reason} |\n`;
        });
    }

    if (unknownDeps.length > 0) {
        report += `\n## ❓ Unknown Status Dependencies (${unknownDeps.length})\n\n`;
        report += `These dependencies have licenses that are not on your allowed or denied lists. Manual review is required.\n\n`;
        report += `| Package | Version | License | Source File |\n| :--- | :--- | :--- | :--- |\n`;
        unknownDeps.forEach(d => {
            report += `| \`${d.name}\` | \`${d.version}\` | \`${d.license}\` | \`${d.manifestFile}\` |\n`;
        });
    }

    const doc = await vscode.workspace.openTextDocument({ content: report, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
}

function deactivate() {
    isActivated = false;
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

module.exports = { activate, deactivate };
// --- END OF FILE extension.js (FINAL) ---