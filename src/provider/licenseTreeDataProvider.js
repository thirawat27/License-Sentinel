// This file defines the LicenseTreeDataProvider class, which provides the data for the tree view in the VS Code extension.
// ไฟล์นี้กำหนดคลาส LicenseTreeDataProvider ซึ่งให้ข้อมูลสำหรับ tree view ในส่วนขยาย VS Code

const vscode = require('vscode'); // Import the VS Code API. นำเข้า VS Code API

// Class that provides the data for the tree view.
// คลาสที่ให้ข้อมูลสำหรับ tree view
class LicenseTreeDataProvider {
    // Constructor for the LicenseTreeDataProvider class.
    // Constructor สำหรับคลาส LicenseTreeDataProvider
    constructor() {
        // Create a new event emitter for when the tree data changes.
        // สร้าง event emitter ใหม่เมื่อข้อมูล tree เปลี่ยนแปลง
        this._onDidChangeTreeData = new vscode.EventEmitter();
        // Expose the event for when the tree data changes.
        // แสดง event เมื่อข้อมูล tree เปลี่ยนแปลง
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Initialize the data array.
        // เริ่มต้น array ข้อมูล
        this.data = [];
    }

    // Refreshes the tree data with the given data.
    // Refresh ข้อมูล tree ด้วยข้อมูลที่กำหนด
    refresh(data) {
        // Set the data to the given data.
        // ตั้งค่าข้อมูลเป็นข้อมูลที่กำหนด
        this.data = data;
        // Fire the event to notify the tree view that the data has changed.
        // เรียก event เพื่อแจ้งให้ tree view ทราบว่าข้อมูลมีการเปลี่ยนแปลง
        this._onDidChangeTreeData.fire();
    }
    
    // Gets the tree item for the given element.
    // ดึง tree item สำหรับ element ที่กำหนด
    getTreeItem(element) {
        // Return the element.
        // คืนค่า element
        return element;
    }

    // Gets the children for the given element.
    // ดึง children สำหรับ element ที่กำหนด
    getChildren(element) {
        // If there is no data or the data array is empty, return an empty array.
        // หากไม่มีข้อมูลหรือ array ข้อมูลว่างเปล่า, คืนค่า array ว่าง
        if (!this.data || this.data.length === 0) {
            return Promise.resolve([]);
        }

        // If there is no element, return the manifest file items.
        // หากไม่มี element, คืนค่า manifest file items
        if (!element) {
            // Group dependencies by their full relative manifest file path
            // จัดกลุ่ม dependencies ตาม full relative manifest file path
            const groups = this.data.reduce((acc, dep) => {
                // Get the manifest file path.
                // ดึง manifest file path
                const key = dep.manifestFile;
                // If the manifest file path is not in the accumulator, create a new array for it.
                // หาก manifest file path ไม่อยู่ใน accumulator, สร้าง array ใหม่สำหรับมัน
                (acc[key] = acc[key] || []).push(dep);
                // Return the accumulator.
                // คืนค่า accumulator
                return acc;
            }, {});

            // Sort manifest files alphabetically for consistent order
            // เรียงลำดับ manifest files ตามตัวอักษรเพื่อความสอดคล้อง
            const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

            // Return the manifest file items.
            // คืนค่า manifest file items
            return Promise.resolve(sortedKeys.map(key => new ManifestFileItem(key, groups[key])));
        }
        
        // If the element is a ManifestFileItem, return the dependency items.
        // หาก element เป็น ManifestFileItem, คืนค่า dependency items
        if (element instanceof ManifestFileItem) {
            // Sort dependencies alphabetically within each manifest file
            // เรียงลำดับ dependencies ตามตัวอักษรภายในแต่ละ manifest file
            const sortedDependencies = element.dependencies.sort((a, b) => a.name.localeCompare(b.name));
            // Return the dependency items.
            // คืนค่า dependency items
            return Promise.resolve(sortedDependencies.map(dep => new DependencyItem(dep)));
        }
        
        // If the element is not a ManifestFileItem, return an empty array.
        // หาก element ไม่ใช่ ManifestFileItem, คืนค่า array ว่าง
        return Promise.resolve([]);
    }
}

// Class that represents a manifest file item in the tree view.
// คลาสที่แสดงถึง manifest file item ใน tree view
class ManifestFileItem extends vscode.TreeItem {
    // Constructor for the ManifestFileItem class.
    // Constructor สำหรับคลาส ManifestFileItem
    constructor(relativePath, dependencies) {
        // Count the number of non-compliant dependencies.
        // นับจำนวน dependencies ที่ non-compliant
        const nonCompliantCount = dependencies.filter(d => d.status === 'non-compliant').length;
        
        // Call the super constructor with the relative path and the expanded state.
        // เรียก super constructor ด้วย relative path และ expanded state
        super(relativePath, vscode.TreeItemCollapsibleState.Expanded);
        
        // Set the dependencies.
        // ตั้งค่า dependencies
        this.dependencies = dependencies;
        // Set the description to the number of dependencies.
        // ตั้งค่า description เป็นจำนวน dependencies
        this.description = `${dependencies.length} dependencies`;
        // Set the icon path to a file code icon.
        // ตั้งค่า icon path เป็น file code icon
        this.iconPath = new vscode.ThemeIcon('file-code'); 

        // If there are non-compliant dependencies, add the number of non-compliant dependencies to the description and set the icon path to an error icon.
        // หากมี dependencies ที่ non-compliant, เพิ่มจำนวน dependencies ที่ non-compliant ไปยัง description และตั้งค่า icon path เป็น error icon
        if (nonCompliantCount > 0) {
            // Add the number of non-compliant dependencies to the description.
            // เพิ่มจำนวน dependencies ที่ non-compliant ไปยัง description
            this.description += ` (${nonCompliantCount} non-compliant)`;
            // Set the icon path to an error icon.
            // ตั้งค่า icon path เป็น error icon
            this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        }

        // Set the context value to identify this item type in package.json's "menus" section.
        // ตั้งค่า context value เพื่อระบุ item type นี้ในส่วน "menus" ของ package.json
        this.contextValue = 'manifestFile';
        
        // Store the URI of the file for the "Go to File" command.
        // เก็บ URI ของไฟล์สำหรับ command "Go to File"
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            // Set the resource URI to the joined path of the workspace folder and the relative path.
            // ตั้งค่า resource URI เป็น joined path ของ workspace folder และ relative path
            this.resourceUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, relativePath);
        }
    }
}

// Class that represents a dependency item in the tree view.
// คลาสที่แสดงถึง dependency item ใน tree view
class DependencyItem extends vscode.TreeItem {
    // Constructor for the DependencyItem class.
    // Constructor สำหรับคลาส DependencyItem
    constructor(dep) {
        // Format the version string to remove the ~ and ^ characters.
        // จัดรูปแบบ version string เพื่อลบตัวอักษร ~ และ ^
        const displayVersion = String(dep.version || '').replace(/[~^]/g, '');
        // Call the super constructor with the dependency name and version and the none state.
        // เรียก super constructor ด้วย dependency name และ version และ none state
        super(`${dep.name} @ ${displayVersion}`, vscode.TreeItemCollapsibleState.None);

        // Set the description to the license.
        // ตั้งค่า description เป็น license
        this.description = dep.license;
        // Set the tooltip to a markdown string with the dependency information.
        // ตั้งค่า tooltip เป็น markdown string พร้อมข้อมูล dependency
        this.tooltip = new vscode.MarkdownString(
            `**Package:** ${dep.name}\n\n` +
            `**Version:** \`${dep.version}\`\n\n` +
            `**License:** \`${dep.license}\`\n\n` +
            `**Status:** ${dep.status}\n\n` +
            `**Source:** \`${dep.manifestFile}\``
        );
        // Set the tooltip to be trusted.
        // ตั้งค่า tooltip ให้เป็น trusted
        this.tooltip.isTrusted = true;

        // Store the full dependency object to pass to commands.
        // เก็บ object dependency ทั้งหมดเพื่อส่งไปยัง commands
        this.dependencyInfo = dep; 
        
        // Set context value based on whether a homepage exists, allowing for conditional menu items.
        // ตั้งค่า context value ตามว่ามี homepage หรือไม่, อนุญาตให้มี conditional menu items
        this.contextValue = 'dependencyItem';
        // If there is a homepage, add the WithHomepage context value.
        // หากมี homepage, เพิ่ม WithHomepage context value
        if (dep.homepage) {
            this.contextValue += 'WithHomepage'; // e.g., 'dependencyItemWithHomepage'
        }

        // If there is a homepage, set the command to open the homepage in a browser.
        // หากมี homepage, ตั้งค่า command เพื่อเปิด homepage ใน browser
        if (dep.homepage) {
            this.command = {
                command: 'vscode.open', // Default click action
                title: 'Open Homepage',
                arguments: [vscode.Uri.parse(dep.homepage)]
            };
        }
        
        // Define icons for each status.
        // กำหนด icons สำหรับแต่ละสถานะ
        const icons = { 
            compliant: new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')), 
            'non-compliant': new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed')), 
            unknown: new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconSkipped')) 
        };
        // Set the icon path to the icon for the dependency status.
        // ตั้งค่า icon path เป็น icon สำหรับสถานะ dependency
        this.iconPath = icons[dep.status] || icons.unknown;
    }
}

// Export the LicenseTreeDataProvider class.
// ส่งออกคลาส LicenseTreeDataProvider
module.exports = { LicenseTreeDataProvider };