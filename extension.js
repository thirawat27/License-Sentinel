// This is the main file for the License Sentinel VS Code extension.
// นี่คือไฟล์หลักสำหรับส่วนขยาย License Sentinel VS Code

const vscode = require('vscode'); // Import the VS Code API. นำเข้า VS Code API
const path = require('path'); // Import the path module for working with file paths. นำเข้าโมดูล path สำหรับการทำงานกับพาธของไฟล์
const fs = require('fs/promises'); // Import the file system module for reading files asynchronously. นำเข้าโมดูลระบบไฟล์สำหรับการอ่านไฟล์แบบอะซิงโครนัส
const { scanWorkspace } = require('./src/core/scanner'); // Import the function to scan the workspace for dependencies. นำเข้าฟังก์ชันสำหรับสแกน workspace เพื่อหา dependencies
const { LicenseTreeDataProvider } = require('./src/provider/licenseTreeDataProvider'); // Import the class that provides the data for the tree view. นำเข้าคลาสที่ให้ข้อมูลสำหรับ tree view
const { DependencyHoverProvider, updateDecorations } = require('./src/features/decorations'); // Import the classes for providing hover information and updating decorations in the editor. นำเข้าคลาสสำหรับให้ข้อมูลเมื่อ hover และอัปเดต decorations ใน editor
const { convertToCsv, debounce } = require('./src/utils/text'); // Import utility functions for converting data to CSV format and debouncing function calls. นำเข้าฟังก์ชัน utility สำหรับแปลงข้อมูลเป็น CSV และ debouncing การเรียกฟังก์ชัน

let dependencyData = []; // Store the dependency data. เก็บข้อมูล dependencies
let isActivated = false; // Track whether the extension has been activated. ติดตามว่า extension ถูกเปิดใช้งานหรือไม่
let uiManagers = {}; // Store the UI managers (tree data provider, hover provider, status bar item). เก็บ UI managers (tree data provider, hover provider, status bar item)
let diagnosticCollection; // Store the diagnostic collection for displaying problems in the editor. เก็บ diagnostic collection สำหรับแสดงปัญหาใน editor

// This function is called when the extension is activated.
// ฟังก์ชันนี้จะถูกเรียกเมื่อ extension ถูกเปิดใช้งาน
async function activate(context) {
    // If the extension is already activated, return.
    // ถ้า extension ถูกเปิดใช้งานแล้ว, ให้ return
    if (isActivated) return;
    isActivated = true;
    console.log('LicenseSentinel is now active!');

    // Create a diagnostic collection.
    // สร้าง diagnostic collection
    diagnosticCollection = vscode.languages.createDiagnosticCollection('license-sentinel');
    context.subscriptions.push(diagnosticCollection);

    // Create a new LicenseTreeDataProvider.
    // สร้าง LicenseTreeDataProvider ใหม่
    const treeDataProvider = new LicenseTreeDataProvider();
    vscode.window.createTreeView('license-sentinel-dependency-view', { treeDataProvider, showCollapseAll: true });

    // Create a new DependencyHoverProvider.
    // สร้าง DependencyHoverProvider ใหม่
    const hoverProvider = new DependencyHoverProvider();
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'license-sentinel.refresh';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // Store the UI managers.
    // เก็บ UI managers
    uiManagers = { treeDataProvider, hoverProvider, statusBarItem };

    // Register the commands.
    // ลงทะเบียน commands
    registerCommands(context);

    // Register the providers.
    // ลงทะเบียน providers
    registerProviders(context);

    // Set up the event listeners.
    // ตั้งค่า event listeners
    setupEventListeners(context);

    // Run the initial scan.
    // เรียกการสแกนเริ่มต้น
    runScan(context);
}

// This function registers the commands.
// ฟังก์ชันนี้ลงทะเบียน commands
function registerCommands(context) {
    // Register the command to start a scan.
    // ลงทะเบียน command สำหรับเริ่มการสแกน
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.startScan', () => runScan(context)));

    // Register the command to refresh the scan.
    // ลงทะเบียน command สำหรับ refresh การสแกน
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.refresh', () => runScan(context)));
    
    // Register the command to clear the cache.
    // ลงทะเบียน command สำหรับ clear cache
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.clearCache', () => {
        // Get all the keys in the workspace state that start with 'license-sentinel:'.
        // ดึง keys ทั้งหมดใน workspace state ที่ขึ้นต้นด้วย 'license-sentinel:'
        const keysToClear = context.workspaceState.keys().filter(key => key.startsWith('license-sentinel:'));

        // Create an array of promises that update the workspace state to remove the cached data.
        // สร้าง array ของ promises ที่อัปเดต workspace state เพื่อลบข้อมูลที่ cached ไว้
        const promises = keysToClear.map(key => context.workspaceState.update(key, undefined));
        
        // Wait for all the promises to resolve.
        // รอให้ promises ทั้งหมด resolve
        Promise.all(promises).then(() => {
            vscode.window.showInformationMessage('LicenseSentinel cache cleared! Starting a new scan...');
            runScan(context);
        });
    }));

    // Register the command to export the report.
    // ลงทะเบียน command สำหรับ export report
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.exportReport', () => exportReport()));

    // Register the command to go to the manifest file.
    // ลงทะเบียน command สำหรับไปที่ manifest file
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.goToManifestFile', (item) => {
        // If the item is a TreeItem and has a resource URI, show the text document.
        // ถ้า item เป็น TreeItem และมี resource URI, ให้แสดง text document
        if (item instanceof vscode.TreeItem && item.resourceUri) {
            vscode.window.showTextDocument(item.resourceUri);
        }
    }));
    
    // Register the command to open the homepage.
    // ลงทะเบียน command สำหรับเปิด homepage
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.openHomepage', (item) => {
        // If the item has dependency info and a homepage, open the homepage in a browser.
        // ถ้า item มี dependency info และมี homepage, ให้เปิด homepage ใน browser
        if (item && item.dependencyInfo && item.dependencyInfo.homepage) {
            vscode.env.openExternal(vscode.Uri.parse(item.dependencyInfo.homepage));
        }
    }));

    // Register the command to copy dependency info.
    // ลงทะเบียน command สำหรับ copy dependency info
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.copyDependencyInfo', (item) => {
        // If the item has dependency info, copy it to the clipboard.
        // ถ้า item มี dependency info, ให้ copy ไปที่ clipboard
        if (item && item.dependencyInfo) {
            vscode.env.clipboard.writeText(JSON.stringify(item.dependencyInfo, null, 2));
            vscode.window.showInformationMessage(`Copied info for ${item.dependencyInfo.name} to clipboard.`);
        }
    }));

    // Register the command to add an allowed license.
    // ลงทะเบียน command สำหรับเพิ่ม allowed license
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.addAllowedLicense', (item) => {
        // If the item has dependency info, update the license policy.
        // ถ้า item มี dependency info, ให้อัปเดต license policy
        if (item && item.dependencyInfo) {
            updateLicensePolicy('allowedLicenses', item.dependencyInfo.license, context);
        }
    }));
    
    // Register the command to add a denied license.
    // ลงทะเบียน command สำหรับเพิ่ม denied license
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.addDeniedLicense', (item) => {
        // If the item has dependency info, update the license policy.
        // ถ้า item มี dependency info, ให้อัปเดต license policy
        if (item && item.dependencyInfo) {
            updateLicensePolicy('deniedLicenses', item.dependencyInfo.license, context);
        }
    }));

    // Register the command to open the settings.
    // ลงทะเบียน command สำหรับเปิด settings
    context.subscriptions.push(vscode.commands.registerCommand('license-sentinel.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'license-sentinel');
    }));
}

// This function registers the providers.
// ฟังก์ชันนี้ลงทะเบียน providers
function registerProviders(context) {
    // Register the hover provider.
    // ลงทะเบียน hover provider
    context.subscriptions.push(vscode.languages.registerHoverProvider(
        ['json', 'jsonc', 'toml', 'xml', { scheme: 'file', language: 'go.mod' }],
        uiManagers.hoverProvider
    ));
    
    // Register the code actions provider.
    // ลงทะเบียน code actions provider
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
        ['json', 'jsonc', 'toml', 'xml', { scheme: 'file', language: 'go.mod' }],
        new LicenseActionProvider(),
        { providedCodeActionKinds: LicenseActionProvider.providedCodeActionKinds }
    ));
}

// This function sets up the event listeners.
// ฟังก์ชันนี้ตั้งค่า event listeners
function setupEventListeners(context) {
    // Create a debounced function to update the UI.
    // สร้าง debounced function เพื่ออัปเดต UI
    const debouncedUpdateAllUI = debounce(() => updateAllUI(dependencyData), 500);

    // Watch for changes to the text documents.
    // เฝ้าดูการเปลี่ยนแปลงของ text documents
    const onSaveWatcher = vscode.workspace.onDidSaveTextDocument(doc => {
        // If the document is a supported file, run a scan.
        // ถ้า document เป็นไฟล์ที่รองรับ, ให้เรียกการสแกน
        const supportedFiles = ['package.json', 'composer.json', 'pyproject.toml', 'pom.xml', 'go.mod', 'Cargo.toml', 'settings.json'];
        if (supportedFiles.some(f => doc.fileName.endsWith(f))) {
            runScan(context);
        }
    });

    // Watch for changes to the active text editor.
    // เฝ้าดูการเปลี่ยนแปลงของ active text editor
    const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
        // If there is an active editor, update the decorations.
        // ถ้ามี active editor, ให้อัปเดต decorations
        if (editor) {
            updateDecorations(editor, dependencyData);
        }
    });

    // Watch for changes to the configuration.
    // เฝ้าดูการเปลี่ยนแปลงของ configuration
    const onConfigChange = vscode.workspace.onDidChangeConfiguration(e => {
        // If the configuration affects the license-sentinel extension, run a scan.
        // ถ้า configuration มีผลต่อ extension license-sentinel, ให้เรียกการสแกน
        if (e.affectsConfiguration('license-sentinel')) {
            runScan(context);
        }
    });
    
    // Add the event listeners to the context.
    // เพิ่ม event listeners ไปที่ context
    context.subscriptions.push(onSaveWatcher, onActiveEditorChange, onConfigChange);
}

// This function runs the scan.
// ฟังก์ชันนี้เรียกการสแกน
async function runScan(context) {
    // Update the status bar item.
    // อัปเดต status bar item
    const { statusBarItem } = uiManagers;
    statusBarItem.text = `$(sync~spin) License Scan`;
    statusBarItem.tooltip = 'LicenseSentinel is scanning your workspace...';
    
    // Show a progress notification.
    // แสดง progress notification
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "LicenseSentinel: Scanning dependencies...",
        cancellable: false
    }, async (progress) => {
        // Scan the workspace.
        // สแกน workspace
        dependencyData = await scanWorkspace(context, progress);

        // Update the UI.
        // อัปเดต UI
        updateAllUI(dependencyData);
    });
}

// This function updates all the UI elements.
// ฟังก์ชันนี้อัปเดต UI elements ทั้งหมด
function updateAllUI(deps) {
    // Get the UI managers.
    // ดึง UI managers
    const { treeDataProvider, hoverProvider, statusBarItem } = uiManagers;
    
    // Refresh the tree data provider.
    // Refresh tree data provider
    treeDataProvider.refresh(deps);

    // Update the hover provider data.
    // อัปเดต hover provider data
    hoverProvider.updateData(deps);

    // Update the status bar.
    // อัปเดต status bar
    updateStatusBar(statusBarItem);

    // If there is an active text editor, update the decorations.
    // ถ้ามี active text editor, ให้อัปเดต decorations
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor, deps);
    }
    
    // Update the diagnostics.
    // อัปเดต diagnostics
    updateDiagnostics(deps);
}

// This function updates the diagnostics.
// ฟังก์ชันนี้อัปเดต diagnostics
async function updateDiagnostics(deps) {
    // Clear the diagnostic collection.
    // Clear diagnostic collection
    diagnosticCollection.clear();

    // Create a map to store the diagnostics by file.
    // สร้าง map เพื่อเก็บ diagnostics ตามไฟล์
    const diagnosticsByFile = new Map();

    // Loop through the dependencies.
    // วนลูป dependencies
    for (const dep of deps) {
        // If the dependency is compliant, skip it.
        // ถ้า dependency เป็น compliant, ให้ข้ามไป
        if (dep.status === 'compliant') continue;

        // Get the file URI.
        // ดึง file URI
        const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, dep.manifestFile);
        
        try {
            // Open the text document.
            // เปิด text document
            const document = await vscode.workspace.openTextDocument(fileUri);

            // Get the text of the document.
            // ดึง text ของ document
            const text = document.getText();

            // Create a regex to find the dependency name.
            // สร้าง regex เพื่อหา dependency name
            const depRegex = new RegExp(`['"]?${dep.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?`);

            // Match the regex against the text.
            // จับคู่ regex กับ text
            const match = text.match(depRegex);

            // Create a range for the diagnostic.
            // สร้าง range สำหรับ diagnostic
            let range = new vscode.Range(0, 0, 0, 100);
            if (match) {
                const line = document.positionAt(match.index).line;
                range = document.lineAt(line).range;
            }

            // Create the diagnostic.
            // สร้าง diagnostic
            const severity = dep.status === 'non-compliant' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
            const diagnostic = new vscode.Diagnostic(range, dep.reason, severity);
            diagnostic.source = 'LicenseSentinel';
            diagnostic.code = `${dep.license}|${dep.name}`;

            // Add the diagnostic to the map.
            // เพิ่ม diagnostic ไปที่ map
            if (!diagnosticsByFile.has(fileUri.path)) {
                diagnosticsByFile.set(fileUri.path, { uri: fileUri, diags: [] });
            }
            diagnosticsByFile.get(fileUri.path).diags.push(diagnostic);
        } catch (error) {
            console.error(`Could not create diagnostic for ${dep.name}:`, error);
        }
    }
    
    // Loop through the diagnostics by file.
    // วนลูป diagnostics ตามไฟล์
    for (const [_, { uri, diags }] of diagnosticsByFile) {
        // Set the diagnostics for the file.
        // ตั้งค่า diagnostics สำหรับไฟล์
        diagnosticCollection.set(uri, diags);
    }
}

// This class provides code actions for license issues.
// คลาสนี้ให้ code actions สำหรับปัญหา license
class LicenseActionProvider {
    // Define the provided code action kinds.
    // กำหนด provided code action kinds
    static providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    // Provide code actions for the given document, range, and context.
    // ให้ code actions สำหรับ document, range, และ context ที่กำหนด
    provideCodeActions(document, range, context, token) {
        // Filter the diagnostics to only include those from LicenseSentinel.
        // กรอง diagnostics เพื่อให้มีเฉพาะที่มาจาก LicenseSentinel
        return context.diagnostics
            .filter(diag => diag.source === 'LicenseSentinel')
            .flatMap(diag => this.createActionsForDiagnostic(diag));
    }

    // Create code actions for the given diagnostic.
    // สร้าง code actions สำหรับ diagnostic ที่กำหนด
    createActionsForDiagnostic(diagnostic) {
        // Split the code into the license string and the dependency name.
        // แยก code เป็น license string และ dependency name
        const [licenseString, depName] = diagnostic.code.split('|');

        // If the license string is invalid, return an empty array.
        // ถ้า license string ไม่ถูกต้อง, ให้ return array ว่าง
        if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) return [];

        // Split the license string into individual licenses.
        // แยก license string เป็น licenses แต่ละตัว
        const licenses = licenseString.split(/ OR |\/|\sOR\s/i).map(l => l.trim());

        // Create an array to store the code actions.
        // สร้าง array เพื่อเก็บ code actions
        const actions = [];
        
        // Create a code action to allow the license.
        // สร้าง code action เพื่อ allow license
        const allowAction = new vscode.CodeAction(`Allow license(s): "${licenses.join(', ')}"`, vscode.CodeActionKind.QuickFix);
        allowAction.command = { 
            command: 'license-sentinel.addAllowedLicense', 
            title: `Allow License(s): ${licenses.join(', ')}`,
            arguments: [{ dependencyInfo: { license: licenseString, name: depName } }]
        };
        allowAction.diagnostics = [diagnostic];
        allowAction.isPreferred = true;
        actions.push(allowAction);

        // Create a code action to deny the license.
        // สร้าง code action เพื่อ deny license
        const denyAction = new vscode.CodeAction(`Deny license(s): "${licenses.join(', ')}"`, vscode.CodeActionKind.QuickFix);
        denyAction.command = {
            command: 'license-sentinel.addDeniedLicense',
            title: `Deny License(s): ${licenses.join(', ')}`,
            arguments: [{ dependencyInfo: { license: licenseString, name: depName } }]
        };
        denyAction.diagnostics = [diagnostic];
        actions.push(denyAction);

        // Return the array of code actions.
        // Return array ของ code actions
        return actions;
    }
}

// This function updates the license policy.
// ฟังก์ชันนี้อัปเดต license policy
async function updateLicensePolicy(policyType, licenseString, context) {
    // If the license string is invalid, show a warning message and return.
    // ถ้า license string ไม่ถูกต้อง, ให้แสดง warning message และ return
    if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) {
        vscode.window.showWarningMessage('Cannot add an invalid license to the policy.');
        return;
    }

    // Get the current configuration.
    // ดึง configuration ปัจจุบัน
    const config = vscode.workspace.getConfiguration('license-sentinel');

    // Get the current policies.
    // ดึง policies ปัจจุบัน
    const currentPolicies = new Set(config.get(policyType, []).map(l => l.toLowerCase()));
    
    // Split the license string into individual licenses.
    // แยก license string เป็น licenses แต่ละตัว
    const licensesToAdd = licenseString.split(/ OR |\/|\sOR\s/i).map(l => l.trim());

    // Add the licenses to the current policies.
    // เพิ่ม licenses ไปที่ policies ปัจจุบัน
    let added = false;
    for (const license of licensesToAdd) {
        if (license && !currentPolicies.has(license.toLowerCase())) {
            currentPolicies.add(license.toLowerCase());
            added = true;
        }
    }

    // If no licenses were added, show an information message and return.
    // ถ้าไม่มี licenses ถูกเพิ่ม, ให้แสดง information message และ return
    if (!added) {
        vscode.window.showInformationMessage(`License(s) in "${licenseString}" are already covered by your policies.`);
        return;
    }

    // Update the configuration.
    // อัปเดต configuration
    await config.update(policyType, [...currentPolicies], vscode.ConfigurationTarget.Workspace);

    // Show an information message.
    // แสดง information message
    vscode.window.showInformationMessage(`Policies updated. Settings.json was modified.`);
}

// This function updates the status bar.
// ฟังก์ชันนี้อัปเดต status bar
function updateStatusBar(statusBarItem) {
    // Count the number of compliant, non-compliant, and unknown dependencies.
    // นับจำนวน dependencies ที่ compliant, non-compliant, และ unknown
    const compliantCount = dependencyData.filter(d => d.status === 'compliant').length;
    const nonCompliantCount = dependencyData.filter(d => d.status === 'non-compliant').length;
    const unknownCount = dependencyData.filter(d => d.status === 'unknown').length;

    // Update the status bar text and tooltip.
    // อัปเดต status bar text และ tooltip
    statusBarItem.text = `$(check) ${compliantCount} | $(warning) ${unknownCount} | $(error) ${nonCompliantCount}`;
    statusBarItem.tooltip = `LicenseSentinel: ${compliantCount} compliant, ${unknownCount} unknown, ${nonCompliantCount} non-compliant.`;

    // If there are any non-compliant dependencies, set the status bar background color to error.
    // ถ้ามี dependencies ที่ non-compliant, ให้ตั้งค่า status bar background color เป็น error
    if (nonCompliantCount > 0) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        statusBarItem.backgroundColor = undefined;
    }
}

// This function exports the report.
// ฟังก์ชันนี้ export report
async function exportReport() {
    // If there is no data to export, show an information message and return.
    // ถ้าไม่มีข้อมูลให้ export, ให้แสดง information message และ return
    if (dependencyData.length === 0) {
        vscode.window.showInformationMessage('No data to export. Run a scan first.');
        return;
    }

    // Show a quick pick to choose the export format.
    // แสดง quick pick เพื่อเลือก export format
    const choice = await vscode.window.showQuickPick(
        [
            { label: 'Markdown Report', description: 'Export a full, human-readable compliance report (.md)', format: 'md' },
            { label: 'CSV Data', description: 'Export raw dependency data as a CSV file (.csv)', format: 'csv' }
        ],
        { placeHolder: 'Choose an export format' }
    );

    // If a choice was made, export the report in the chosen format.
    // ถ้ามีการเลือก, ให้ export report ใน format ที่เลือก
    if (choice) {
        if (choice.format === 'md') {
            await _exportAsMarkdown();
        } else if (choice.format === 'csv') {
            await _exportAsCsv();
        }
    }
}

// This function exports the report as a CSV file.
// ฟังก์ชันนี้ export report เป็นไฟล์ CSV
async function _exportAsCsv() {
    try {
        // Map the dependency data to a CSV-friendly format.
        // Map dependency data ไปเป็น format ที่ CSV รองรับ
        const csvData = dependencyData.map(dep => ({
            name: dep.name,
            version: dep.version,
            license: dep.license,
            status: dep.status,
            risk: dep.riskLevel,
            homepage: dep.homepage,
            source: dep.manifestFile
        }));

        // Convert the data to CSV format.
        // แปลงข้อมูลเป็น format CSV
        const csvContent = convertToCsv(csvData);
        
        // Get the workspace folder.
        // ดึง workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined;

        // Create a default URI for the save dialog.
        // สร้าง default URI สำหรับ save dialog
        const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder, 'license-report.csv') : undefined;

        // Show the save dialog.
        // แสดง save dialog
        const uri = await vscode.window.showSaveDialog({ defaultUri, filters: { 'CSV files': ['csv'] } });

        // If a URI was chosen, write the CSV content to the file.
        // ถ้ามีการเลือก URI, ให้เขียน CSV content ไปที่ไฟล์
        if (uri) {
            await fs.writeFile(uri.fsPath, csvContent, 'utf8');
            vscode.window.showInformationMessage(`CSV report saved to ${path.basename(uri.fsPath)}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage('Failed to export CSV report.');
        console.error(error);
    }
}

// This function exports the report as a Markdown file.
// ฟังก์ชันนี้ export report เป็นไฟล์ Markdown
async function _exportAsMarkdown() {
    // Filter the dependencies into non-compliant and unknown.
    // กรอง dependencies เป็น non-compliant และ unknown
    const nonCompliantDeps = dependencyData.filter(d => d.status === 'non-compliant');
    const unknownDeps = dependencyData.filter(d => d.status === 'unknown');

    // Calculate the number of compliant dependencies.
    // คำนวณจำนวน dependencies ที่ compliant
    const compliantCount = dependencyData.length - nonCompliantDeps.length - unknownDeps.length;
    
    // Create the Markdown report.
    // สร้าง Markdown report
    let report = `# 🛡️ License Sentinel - Compliance Report\n\n`;
    report += `**Generated:** ${new Date().toUTCString()}\n\n`;
    report += `## 📊 Summary\n\n`;
    report += `| Status | Count |\n| :--- | :---: |\n`;
    report += `| ✅ Compliant | ${compliantCount} |\n`;
    report += `| ❓ Unknown | ${unknownDeps.length} |\n`;
    report += `| ❌ Non-Compliant | ${nonCompliantDeps.length} |\n\n`;

    // Add the non-compliant dependencies to the report.
    // เพิ่ม non-compliant dependencies ไปที่ report
    if (nonCompliantDeps.length > 0) {
        report += `## ❌ Non-Compliant Dependencies (${nonCompliantDeps.length})\n\n`;
        report += `These dependencies have licenses that are explicitly forbidden by your project's policy.\n\n`;
        report += `| Package | Version | License | Reason |\n| :--- | :--- | :--- | :--- |\n`;
        nonCompliantDeps.forEach(d => {
            report += `| \`${d.name}\` | \`${d.version}\` | \`${d.license}\` | ${d.reason.split('. ')[1] || d.reason} |\n`;
        });
    }

    // Add the unknown dependencies to the report.
    // เพิ่ม unknown dependencies ไปที่ report
    if (unknownDeps.length > 0) {
        report += `\n## ❓ Unknown Status Dependencies (${unknownDeps.length})\n\n`;
        report += `These dependencies have licenses that are not on your allowed or denied lists. Manual review is required.\n\n`;
        report += `| Package | Version | License | Source File |\n| :--- | :--- | :--- | :--- |\n`;
        unknownDeps.forEach(d => {
            report += `| \`${d.name}\` | \`${d.version}\` | \`${d.license}\` | \`${d.manifestFile}\` |\n`;
        });
    }

    // Open the report in a text document.
    // เปิด report ใน text document
    const doc = await vscode.workspace.openTextDocument({ content: report, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
}

// This function is called when the extension is deactivated.
// ฟังก์ชันนี้จะถูกเรียกเมื่อ extension ถูกปิดใช้งาน
function deactivate() {
    isActivated = false;
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

module.exports = { activate, deactivate };