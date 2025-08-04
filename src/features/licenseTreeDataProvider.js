// This file defines the LicenseTreeDataProvider, which is responsible for displaying license information in a tree view within VS Code.

const vscode = require('vscode');

class LicenseTreeDataProvider {
    constructor() {
        // Create an event emitter to signal when the tree data changes.
        this._onDidChangeTreeData = new vscode.EventEmitter();
        // Expose the event for listeners to subscribe to data change notifications.
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Initialize the data store for the tree view.
        this.data = [];
    }

    /**
     * Refreshes the tree view with new data.
     * @param {Array<object>} data - The new data to display in the tree view.
     */
    refresh(data) {
        // Update the internal data store.
        this.data = data;
        // Trigger the event to notify the tree view that the data has changed.
        this._onDidChangeTreeData.fire();
    }
    
    /**
     * Gets the tree item for a given element.
     * @param {vscode.TreeItem} element - The element to get the tree item for.
     * @returns {vscode.TreeItem} - The tree item for the element.
     */
    getTreeItem(element) {
        // Return the element itself as the tree item.
        return element;
    }

    /**
     * Gets the children for a given element in the tree.
     * @param {vscode.TreeItem} element - The element to get the children for. If undefined, returns the root elements.
     * @returns {Promise<Array<vscode.TreeItem>>} - A promise that resolves to an array of tree items representing the children.
     */
    getChildren(element) {
        // If there is no data, return an empty array.
        if (!this.data || this.data.length === 0) {
            return Promise.resolve([]);
        }

        // If no element is provided, return the root elements (manifest files).
        if (!element) {
            // Group dependencies by manifest file.
            const groups = this.data.reduce((acc, dep) => {
                const key = dep.manifestFile;
                (acc[key] = acc[key] || []).push(dep);
                return acc;
            }, {});

            // Sort the manifest file paths alphabetically.
            const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
            // Create a ManifestFileItem for each manifest file.
            return Promise.resolve(sortedKeys.map(key => new ManifestFileItem(key, groups[key])));
        }
        
        // If the element is a ManifestFileItem, return its dependencies.
        if (element instanceof ManifestFileItem) {
            // Sort the dependencies alphabetically by name.
            const sortedDependencies = element.dependencies.sort((a, b) => a.name.localeCompare(b.name));
            // Create a DependencyItem for each dependency.
            return Promise.resolve(sortedDependencies.map(dep => new DependencyItem(dep)));
        }

        // If the element is a DependencyItem, return its obligations.
        if (element instanceof DependencyItem) {
            const obligations = element.dependencyInfo.analysis?.obligations || [];
            if (obligations.length > 0) {
                return Promise.resolve(obligations.map(ob => new ObligationItem(ob)));
            }
        }
        
        // If the element has no children, return an empty array.
        return Promise.resolve([]);
    }
}

/**
 * Represents a manifest file in the tree view.
 */
class ManifestFileItem extends vscode.TreeItem {
    /**
     * Creates a new ManifestFileItem.
     * @param {string} relativePath - The relative path to the manifest file.
     * @param {Array<object>} dependencies - The dependencies defined in the manifest file.
     */
    constructor(relativePath, dependencies) {
        // Count the number of non-compliant dependencies in the manifest file.
        const nonCompliantCount = dependencies.filter(d => d.status === 'non-compliant').length;
        
        // Call the super constructor with the relative path and an expanded state.
        super(relativePath, vscode.TreeItemCollapsibleState.Expanded);
        
        // Store the dependencies.
        this.dependencies = dependencies;
        // Set the description to show the number of dependencies.
        this.description = `${dependencies.length} dependencies`;
        // Set the icon to a code file.
        this.iconPath = new vscode.ThemeIcon('file-code'); 

        // If there are non-compliant dependencies, update the description and icon.
        if (nonCompliantCount > 0) {
            this.description += ` (${nonCompliantCount} non-compliant)`;
            this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        }

        // Set the context value to 'manifestFile'.
        this.contextValue = 'manifestFile';
        
        // If there is a workspace folder, set the resource URI to the manifest file.
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.resourceUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, relativePath);
        }
    }
}

/**
 * Represents a dependency in the tree view.
 */
class DependencyItem extends vscode.TreeItem {
    /**
     * Creates a new DependencyItem.
     * @param {object} dep - The dependency information.
     */
    constructor(dep) {
        // Remove any semver range characters (~^) from the version string.
        const displayVersion = String(dep.version || '').replace(/[~^]/g, '');
        // Set the collapsible state based on whether the dependency has obligations.
        const collapsibleState = (dep.analysis?.obligations?.length > 0)
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        // Call the super constructor with the dependency name and version, and the collapsible state.
        super(`${dep.name} @ ${displayVersion}`, collapsibleState);

        // Set the description to the license.
        this.description = dep.license;
        // Create a tooltip with detailed dependency information.
        this.tooltip = new vscode.MarkdownString(
            `**Package:** ${dep.name}\n\n` +
            `**Version:** \`${dep.version}\`\n\n` +
            `**License:** \`${dep.license}\`\n\n` +
            `**Status:** ${dep.status}\n\n` +
            `**Reason:** ${dep.analysis?.reason || 'N/A'}\n\n` +
            `**Source:** \`${dep.manifestFile}\``
        );
        this.tooltip.isTrusted = true;

        // Store the dependency information.
        this.dependencyInfo = dep; 
        
        // Set the context value to 'dependencyItem'.
        this.contextValue = 'dependencyItem';
        // If the dependency has a homepage, add 'WithHomepage' to the context value.
        if (dep.homepage) {
            this.contextValue += 'WithHomepage';
        }

        // If the dependency has a homepage, set the command to open it in a browser.
        if (dep.homepage) {
            this.command = {
                command: 'vscode.open',
                title: 'Open Homepage',
                arguments: [vscode.Uri.parse(dep.homepage)]
            };
        }
        
        // Define icons for each compliance status.
        const icons = { 
            compliant: new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')), 
            'non-compliant': new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed')), 
            unknown: new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconSkipped')) 
        };
        // Set the icon based on the dependency's status.
        this.iconPath = icons[dep.status] || icons.unknown;
    }
}

/**
 * Represents an obligation in the tree view.
 */
class ObligationItem extends vscode.TreeItem {
    /**
     * Creates a new ObligationItem.
     * @param {object} obligation - The obligation information.
     */
    constructor(obligation) {
        // Call the super constructor with the obligation summary and no collapsible state.
        super(obligation.summary, vscode.TreeItemCollapsibleState.None);
        
        // Define icons for each risk level.
        const riskIcons = {
            high: new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed')),
            medium: new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconSkipped')),
            low: new vscode.ThemeIcon('info')
        };

        // Set the icon based on the obligation's risk level.
        this.iconPath = riskIcons[obligation.risk] || riskIcons.low;
        // Set the tooltip to the risk level.
        this.tooltip = `Risk Level: ${obligation.risk}`;
    }
}

module.exports = { LicenseTreeDataProvider };