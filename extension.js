const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { scanWorkspace } = require('./src/core/scanner');
const { LicenseTreeDataProvider } = require('./src/provider/licenseTreeDataProvider');
const { DependencyHoverProvider, updateDecorations } = require('./src/features/decorations');
const { convertToCsv, debounce } = require('./src/utils');

let dependencyData = [];

async function activate(context) {
    console.log('LicenseSentinel is now active!');

    const treeDataProvider = new LicenseTreeDataProvider();
    vscode.window.createTreeView('license-sentinel-dependency-view', { treeDataProvider });

    const hoverProvider = new DependencyHoverProvider();
    context.subscriptions.push(vscode.languages.registerHoverProvider(['json', 'jsonc', 'xml', 'toml', 'go.mod'], hoverProvider));

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'license-sentinel.refresh';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // -- Commands Registration --
    const refreshCommand = vscode.commands.registerCommand('license-sentinel.refresh',
        () => runScan(context, treeDataProvider, hoverProvider, statusBarItem)
    );
    const clearCacheCommand = vscode.commands.registerCommand('license-sentinel.clearCache', () => {
        context.workspaceState.keys().forEach(key => {
            if (key.startsWith('license-sentinel-') || key.startsWith('file-') || key.startsWith('deps-data-')) {
                context.workspaceState.update(key, undefined);
            }
        });
        vscode.window.showInformationMessage('LicenseSentinel cache cleared!');
        vscode.commands.executeCommand('license-sentinel.refresh');
    });
    const exportCsvCommand = vscode.commands.registerCommand('license-sentinel.exportCsv', () => exportDataAsCsv());
    context.subscriptions.push(refreshCommand, clearCacheCommand, exportCsvCommand);

    // -- Event Listeners --
    const debouncedUpdateDecorations = debounce((editor) => {
        if (editor) {
            updateDecorations(editor, dependencyData);
        }
    }, 500);

    vscode.workspace.onDidSaveTextDocument(doc => {
        const fileName = path.basename(doc.fileName);
        const supportedFiles = ['package.json', 'composer.json', 'pyproject.toml', 'pom.xml', 'go.mod', 'Cargo.toml'];
        if (supportedFiles.includes(fileName)) {
            // สแกนเฉพาะไฟล์ที่ถูกแก้ไข
            runScan(context, treeDataProvider, hoverProvider, statusBarItem, fileName);
        }
    }, null, context.subscriptions);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        debouncedUpdateDecorations(editor);
    }, null, context.subscriptions);

    // -- Initial Scan --
    runScan(context, treeDataProvider, hoverProvider, statusBarItem);
}

/**
 * ฟังก์ชันควบคุมการสแกนและอัปเดต UI ทั้งหมด
 * @param {string | null} specificManifest - ไฟล์ที่ต้องการสแกนโดยเฉพาะ
 */
async function runScan(context, treeDataProvider, hoverProvider, statusBarItem, specificManifest = null) {
    statusBarItem.text = `$(sync~spin) Scanning...`;
    statusBarItem.tooltip = 'LicenseSentinel is scanning dependencies.';
    statusBarItem.backgroundColor = undefined;

    await vscode.window.withProgress({
        location: { viewId: 'license-sentinel-dependency-view' },
        title: "LicenseSentinel: Scanning..."
    }, async (progress) => {
        const processedDeps = await scanWorkspace(context, progress, specificManifest);

        // ถ้าเป็นการสแกนเฉพาะไฟล์ ให้รวมผลลัพธ์กับข้อมูลเก่า
        if (specificManifest) {
            // ลบข้อมูลเก่าของ manifest นี้ออก แล้วเพิ่มข้อมูลใหม่เข้าไป
            const otherDeps = dependencyData.filter(d => d.manifestFile !== specificManifest);
            dependencyData = [...otherDeps, ...processedDeps];
        } else {
            dependencyData = processedDeps;
        }

        // อัปเดต UI ทุกส่วน
        treeDataProvider.refresh(dependencyData);
        hoverProvider.updateData(dependencyData);
        if (vscode.window.activeTextEditor) {
            updateDecorations(vscode.window.activeTextEditor, dependencyData);
        }

        // อัปเดต Status Bar
        updateStatusBar(statusBarItem);
    });
}

function updateStatusBar(statusBarItem) {
    const compliantCount = dependencyData.filter(d => d.status === 'compliant').length;
    const nonCompliantCount = dependencyData.filter(d => d.status === 'non-compliant').length;
    const unknownCount = dependencyData.filter(d => d.status === 'unknown' || d.license === 'Error').length;

    statusBarItem.text = `$(shield) ${compliantCount} | $(question) ${unknownCount} | $(error) ${nonCompliantCount}`;
    statusBarItem.tooltip = `LicenseSentinel: ${compliantCount} compliant, ${unknownCount} unknown, ${nonCompliantCount} non-compliant. Click to refresh.`;

    if (nonCompliantCount > 0) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        statusBarItem.backgroundColor = undefined;
    }
}

async function exportDataAsCsv() {
    if (dependencyData.length === 0) {
        vscode.window.showInformationMessage('No dependency data to export. Please run a scan first.');
        return;
    }
    const csvContent = convertToCsv(dependencyData);
    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
    const defaultUri = vscode.Uri.file(path.join(workspaceFolder, 'license-report.csv'));

    const uri = await vscode.window.showSaveDialog({ defaultUri, filters: { 'CSV File': ['csv'] } });
    if (uri) {
        fs.writeFileSync(uri.fsPath, csvContent);
        vscode.window.showInformationMessage('Report saved successfully!');
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};