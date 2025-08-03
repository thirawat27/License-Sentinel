// --- START OF FILE src/provider/licenseTreeDataProvider.js ---
const vscode = require('vscode');

class LicenseTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.data = [];
    }

    refresh(data) {
        this.data = data;
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!this.data || this.data.length === 0) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Group dependencies by their full relative manifest file path
            const groups = this.data.reduce((acc, dep) => {
                const key = dep.manifestFile;
                (acc[key] = acc[key] || []).push(dep);
                return acc;
            }, {});

            // Sort manifest files alphabetically for consistent order
            const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

            return Promise.resolve(sortedKeys.map(key => new ManifestFileItem(key, groups[key])));
        }
        
        if (element instanceof ManifestFileItem) {
            // Sort dependencies alphabetically within each manifest file
            const sortedDependencies = element.dependencies.sort((a, b) => a.name.localeCompare(b.name));
            return Promise.resolve(sortedDependencies.map(dep => new DependencyItem(dep)));
        }
        
        return Promise.resolve([]);
    }
}

class ManifestFileItem extends vscode.TreeItem {
    constructor(relativePath, dependencies) {
        const nonCompliantCount = dependencies.filter(d => d.status === 'non-compliant').length;
        
        super(relativePath, vscode.TreeItemCollapsibleState.Expanded);
        
        this.dependencies = dependencies;
        this.description = `${dependencies.length} dependencies`;
        this.iconPath = new vscode.ThemeIcon('file-code'); 

        if (nonCompliantCount > 0) {
            this.description += ` (${nonCompliantCount} non-compliant)`;
            this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        }

        // --- START: ส่วนที่เพิ่มเข้ามา ---
        // Set the context value to identify this item type in package.json's "menus" section.
        this.contextValue = 'manifestFile';
        
        // Store the URI of the file for the "Go to File" command.
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.resourceUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, relativePath);
        }
        // --- END: ส่วนที่เพิ่มเข้ามา ---
    }
}

class DependencyItem extends vscode.TreeItem {
    constructor(dep) {
        const displayVersion = String(dep.version || '').replace(/[~^]/g, '');
        super(`${dep.name} @ ${displayVersion}`, vscode.TreeItemCollapsibleState.None);

        this.description = dep.license;
        this.tooltip = new vscode.MarkdownString(
            `**Package:** ${dep.name}\n\n` +
            `**Version:** \`${dep.version}\`\n\n` +
            `**License:** \`${dep.license}\`\n\n` +
            `**Status:** ${dep.status}\n\n` +
            `**Source:** \`${dep.manifestFile}\``
        );
        this.tooltip.isTrusted = true;

        // --- START: ส่วนที่เพิ่มเข้ามา ---
        // Store the full dependency object to pass to commands.
        this.dependencyInfo = dep; 
        
        // Set context value based on whether a homepage exists, allowing for conditional menu items.
        this.contextValue = 'dependencyItem';
        if (dep.homepage) {
            this.contextValue += 'WithHomepage'; // e.g., 'dependencyItemWithHomepage'
        }
        // --- END: ส่วนที่เพิ่มเข้ามา ---

        if (dep.homepage) {
            this.command = {
                command: 'vscode.open', // Default click action
                title: 'Open Homepage',
                arguments: [vscode.Uri.parse(dep.homepage)]
            };
        }
        
        const icons = { 
            compliant: new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')), 
            'non-compliant': new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed')), 
            unknown: new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconSkipped')) 
        };
        this.iconPath = icons[dep.status] || icons.unknown;
    }
}

module.exports = { LicenseTreeDataProvider };