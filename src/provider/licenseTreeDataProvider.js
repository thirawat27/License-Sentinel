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
        if (!element) {
            const groups = this.data.reduce((acc, dep) => {
                (acc[dep.manifestFile] = acc[dep.manifestFile] || []).push(dep);
                return acc;
            }, {});
            return Promise.resolve(Object.keys(groups).map(key => new ManifestFileItem(key, groups[key])));
        }
        
        if (element instanceof ManifestFileItem) {
            return Promise.resolve(element.dependencies.map(dep => new DependencyItem(dep)));
        }
    }
}

class ManifestFileItem extends vscode.TreeItem {
    constructor(label, dependencies) {
        const nonCompliantCount = dependencies.filter(d => d.status === 'non-compliant').length;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.dependencies = dependencies;
        this.description = `${dependencies.length} dependencies`;
        this.iconPath = new vscode.ThemeIcon(nonCompliantCount > 0 ? 'error' : 'file-code');
        if (nonCompliantCount > 0) {
            this.description += ` (${nonCompliantCount} non-compliant)`;
        }
    }
}

class DependencyItem extends vscode.TreeItem {
    constructor(dep) {
        super(`${dep.name} @ ${dep.version.replace(/[~^]/g, '')}`, vscode.TreeItemCollapsibleState.None);
        this.description = dep.license;
        this.tooltip = `License: ${dep.license}\nStatus: ${dep.status}`;
        if (dep.homepage) {
            this.command = {
                command: 'vscode.open',
                title: 'Open Homepage',
                arguments: [vscode.Uri.parse(dep.homepage)]
            };
        }
        
        const icons = { compliant: 'check', 'non-compliant': 'error', unknown: 'question' };
        this.iconPath = new vscode.ThemeIcon(icons[dep.status] || 'question');
    }
}

module.exports = { LicenseTreeDataProvider };