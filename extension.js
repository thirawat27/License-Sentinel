const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { scanWorkspace } = require('./src/core/scanner');
const { LicenseTreeDataProvider } = require('./src/provider/licenseTreeDataProvider');
const { DependencyHoverProvider, updateDecorations } = require('./src/features/decorations');
const { convertToCsv, debounce } = require('./src/utils');

// State ส่วนกลางสำหรับเก็บข้อมูลล่าสุด เพื่อใช้ในฟังก์ชัน export
let dependencyData = [];

// Flag เพื่อป้องกันการ Activate ซ้ำ
let isActivated = false;

/**
 * ฟังก์ชันหลักที่จะถูกเรียกเมื่อ Extension เริ่มทำงาน
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    // ตรวจสอบ Flag: ถ้า Activate ไปแล้ว ให้ออกจากฟังก์ชันทันที
    if (isActivated) {
        return;
    }
    isActivated = true; // ตั้งค่า Flag ว่า Activate แล้ว

    console.log('LicenseSentinel is now active!');

    // 1. ตั้งค่า UI Providers ทั้งหมด
    const treeDataProvider = new LicenseTreeDataProvider();
    vscode.window.createTreeView('license-sentinel-dependency-view', { treeDataProvider });

    const hoverProvider = new DependencyHoverProvider();
    context.subscriptions.push(vscode.languages.registerHoverProvider(['json', 'jsonc', 'xml', 'toml', 'go.mod'], hoverProvider));

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'license-sentinel.refresh';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();


    // 2. ลงทะเบียนคำสั่งทั้งหมด
    const refreshCommand = vscode.commands.registerCommand('license-sentinel.refresh',
        () => runScan(context, treeDataProvider, hoverProvider, statusBarItem)
    );
    const clearCacheCommand = vscode.commands.registerCommand('license-sentinel.clearCache', () => {
        // อัปเดต key ให้ตรงกับที่ใช้ใน caching.js และ scanner.js
        context.workspaceState.keys().forEach(key => {
            if (key.startsWith('license-sentinel-') || key.startsWith('file-mtime-') || key.startsWith('deps-data-')) {
                context.workspaceState.update(key, undefined);
            }
        });
        vscode.window.showInformationMessage('LicenseSentinel cache cleared!');
        vscode.commands.executeCommand('license-sentinel.refresh');
    });
    const exportCsvCommand = vscode.commands.registerCommand('license-sentinel.exportCsv', () => exportDataAsCsv());

    context.subscriptions.push(refreshCommand, clearCacheCommand, exportCsvCommand);


    // 3. ตั้งค่า Automation และ Event Listeners
    const debouncedUpdateDecorations = debounce((editor) => {
        if (editor) {
            updateDecorations(editor, dependencyData);
        }
    }, 500);

    vscode.workspace.onDidSaveTextDocument(doc => {
        const fileName = path.basename(doc.fileName);
        const supportedFiles = ['package.json', 'composer.json', 'pyproject.toml', 'pom.xml', 'go.mod', 'Cargo.toml'];
        if (supportedFiles.includes(fileName)) {
            // ส่งชื่อไฟล์ที่ถูกแก้ไขเพื่อสแกนแบบเจาะจง
            runScan(context, treeDataProvider, hoverProvider, statusBarItem, fileName);
        }
    }, null, context.subscriptions);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        debouncedUpdateDecorations(editor);
    }, null, context.subscriptions);


    // 4. สแกนครั้งแรกเมื่อ Extension เริ่มทำงาน
    runScan(context, treeDataProvider, hoverProvider, statusBarItem);
}

/**
 * ฟังก์ชันควบคุมการสแกนและอัปเดต UI ทั้งหมด
 * @param {vscode.ExtensionContext} context
 * @param {LicenseTreeDataProvider} treeDataProvider
 * @param {DependencyHoverProvider} hoverProvider
 * @param {vscode.StatusBarItem} statusBarItem
 * @param {string | null} specificManifest - ไฟล์ที่ต้องการสแกนโดยเฉพาะ
 */
async function runScan(context, treeDataProvider, hoverProvider, statusBarItem, specificManifest = null) {
    statusBarItem.text = `$(sync~spin) Scanning...`;
    statusBarItem.tooltip = 'LicenseSentinel is scanning your dependencies.';
    statusBarItem.backgroundColor = undefined;

    await vscode.window.withProgress({
        location: { viewId: 'license-sentinel-dependency-view' },
        title: "LicenseSentinel: Scanning dependencies..."
    }, async (progress) => {
        const processedDeps = await scanWorkspace(context, progress, specificManifest);

        // ถ้าเป็นการสแกนเฉพาะไฟล์ ให้รวมผลลัพธ์กับข้อมูลเก่า
        if (specificManifest) {
            const otherDeps = dependencyData.filter(d => d.manifestFile !== specificManifest);
            dependencyData = [...otherDeps, ...processedDeps];
        } else {
            dependencyData = processedDeps;
        }

        // อัปเดต UI ทุกส่วนด้วยข้อมูลใหม่
        treeDataProvider.refresh(dependencyData);
        hoverProvider.updateData(dependencyData);
        if (vscode.window.activeTextEditor) {
            updateDecorations(vscode.window.activeTextEditor, dependencyData);
        }

        // อัปเดต Status Bar ด้วยผลลัพธ์
        updateStatusBar(statusBarItem);
    });
}

/**
 * อัปเดตข้อมูลบน Status Bar
 * @param {vscode.StatusBarItem} statusBarItem
 */
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

/**
 * ฟังก์ชันสำหรับ Export ข้อมูลเป็นไฟล์ CSV
 */
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

function deactivate() {
    isActivated = false; // รีเซ็ต Flag เมื่อปิด Extension
}

module.exports = {
    activate,
    deactivate
};