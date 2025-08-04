// --- START OF FILE src/features/licenseTreeDataProvider.js (FINAL) ---

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
            const groups = this.data.reduce((acc, dep) => {
                const key = dep.manifestFile;
                (acc[key] = acc[key] || []).push(dep);
                return acc;
            }, {});

            const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
            return Promise.resolve(sortedKeys.map(key => new ManifestFileItem(key, groups[key])));
        }
        
        if (element instanceof ManifestFileItem) {
            const sortedDependencies = element.dependencies.sort((a, b) => a.name.localeCompare(b.name));
            return Promise.resolve(sortedDependencies.map(dep => new DependencyItem(dep)));
        }

        if (element instanceof DependencyItem) {
            const obligations = element.dependencyInfo.analysis?.obligations || [];
            if (obligations.length > 0) {
                return Promise.resolve(obligations.map(ob => new ObligationItem(ob)));
            }
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

        this.contextValue = 'manifestFile';
        
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.resourceUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, relativePath);
        }
    }
}

class DependencyItem extends vscode.TreeItem {
    constructor(dep) {
        const displayVersion = String(dep.version || '').replace(/[~^]/g, '');
        const collapsibleState = (dep.analysis?.obligations?.length > 0)
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        super(`${dep.name} @ ${displayVersion}`, collapsibleState);

        this.description = dep.license;
        this.tooltip = new vscode.MarkdownString(
            `**Package:** ${dep.name}\n\n` +
            `**Version:** \`${dep.version}\`\n\n` +
            `**License:** \`${dep.license}\`\n\n` +
            `**Status:** ${dep.status}\n\n` +
            `**Reason:** ${dep.analysis?.reason || 'N/A'}\n\n` +
            `**Source:** \`${dep.manifestFile}\``
        );
        this.tooltip.isTrusted = true;

        this.dependencyInfo = dep; 
        
        this.contextValue = 'dependencyItem';
        if (dep.homepage) {
            this.contextValue += 'WithHomepage';
        }

        if (dep.homepage) {
            this.command = {
                command: 'vscode.open',
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

class ObligationItem extends vscode.TreeItem {
    constructor(obligation) {
        super(obligation.summary, vscode.TreeItemCollapsibleState.None);
        
        const riskIcons = {
            high: new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed')),
            medium: new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconSkipped')),
            low: new vscode.ThemeIcon('info')
        };

        this.iconPath = riskIcons[obligation.risk] || riskIcons.low;
        this.tooltip = `Risk Level: ${obligation.risk}`;
    }
}

module.exports = { LicenseTreeDataProvider };
// --- END OF FILE src/features/licenseTreeDataProvider.js (FINAL) ---