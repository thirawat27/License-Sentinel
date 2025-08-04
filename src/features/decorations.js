// This file handles the decorations in the editor to show license compliance status.
// ไฟล์นี้จัดการ decorations ใน editor เพื่อแสดงสถานะ compliance ของ license

const vscode = require("vscode"); // Import VS Code API. นำเข้า VS Code API
const jsonc = require("jsonc-parser"); // Import JSONC parser for JSON with comments. นำเข้า JSONC parser สำหรับ JSON ที่มี comments

// Decoration styles (ไม่มีการเปลี่ยนแปลง)
// Decoration styles for different compliance statuses. รูปแบบ decoration สำหรับสถานะ compliance ที่แตกต่างกัน
const compliantDecorationType = vscode.window.createTextEditorDecorationType({
    // Style for compliant dependencies. สไตล์สำหรับ dependencies ที่ compliant
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.addedResourceForeground") },
});
const nonCompliantDecorationType = vscode.window.createTextEditorDecorationType({
    // Style for non-compliant dependencies. สไตล์สำหรับ dependencies ที่ non-compliant
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.deletedResourceForeground"), fontWeight: "bold" },
});
const unknownDecorationType = vscode.window.createTextEditorDecorationType({
    // Style for dependencies with unknown compliance status. สไตล์สำหรับ dependencies ที่มีสถานะ compliance ไม่ทราบ
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.modifiedResourceForeground") },
});

/**
 * Updates the decorations in the editor to show license compliance status.
 * @param {vscode.TextEditor} editor The editor to update.
 * @param {Array<object>} allDependencies All dependencies in the workspace.
 */
// Updates the decorations in the editor to show license compliance status.
// อัปเดต decorations ใน editor เพื่อแสดงสถานะ compliance ของ license
function updateDecorations(editor, allDependencies) {
    // If there is no editor or no dependencies, return. ถ้าไม่มี editor หรือไม่มี dependencies, ให้ return
    if (!editor || allDependencies.length === 0) return;

    // Get the document from the editor. ดึง document จาก editor
    const document = editor.document;
    // Get the relative path of the document. ดึง relative path ของ document
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    // Filter the dependencies to only include those that are in the current document. กรอง dependencies เพื่อให้มีเฉพาะ dependencies ที่อยู่ใน document ปัจจุบัน
    const relevantDeps = allDependencies.filter(
        (dep) => dep.manifestFile === relativePath
    );

    // If there are no relevant dependencies, clear the decorations and return. ถ้าไม่มี relevant dependencies, เคลียร์ decorations และ return
    if (relevantDeps.length === 0) {
        editor.setDecorations(compliantDecorationType, []);
        editor.setDecorations(nonCompliantDecorationType, []);
        editor.setDecorations(unknownDecorationType, []);
        return;
    }

    // Create arrays to store the decorations for each compliance status. สร้าง arrays เพื่อเก็บ decorations สำหรับแต่ละสถานะ compliance
    const compliantDecorations = [];
    const nonCompliantDecorations = [];
    const unknownDecorations = [];

    // Get the text of the document. ดึง text ของ document
    const text = document.getText();
    // Create a map of dependency names to dependency data. สร้าง map ของ dependency names ไปยัง dependency data
    const depsMap = new Map(relevantDeps.map(d => [d.name, d]));

    // Get the file language. ดึง file language
    const fileLang = document.languageId;

    // Parse decorations based on the file language. Parse decorations ตาม file language
    if (fileLang === 'json' || fileLang === 'jsonc') {
        // Parse JSON decorations. Parse JSON decorations
        parseJsonDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else if (fileLang === 'toml') {
        // Parse TOML decorations. Parse TOML decorations
        parseTomlDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else {
        // Parse decorations using regex. This is a fallback for formats like go.mod and requirements.txt
        // Parse decorations โดยใช้ regex ซึ่งเป็น fallback สำหรับ format เช่น go.mod และ requirements.txt
        parseRegexDecorations(document, text, relevantDeps, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    }

    // Set the decorations in the editor. ตั้งค่า decorations ใน editor
    editor.setDecorations(compliantDecorationType, compliantDecorations);
    editor.setDecorations(nonCompliantDecorationType, nonCompliantDecorations);
    editor.setDecorations(unknownDecorationType, unknownDecorations);
}

/**
 * Creates a decoration object for a given line and dependency data.
 * @param {vscode.TextLine} line The line to decorate.
 * @param {object} depData The dependency data.
 * @returns {object} The decoration object.
 */
// Creates a decoration object for a given line and dependency data.
// สร้าง decoration object สำหรับ line และ dependency data ที่กำหนด
function createDecoration(line, depData) {
    // Return the decoration object. คืนค่า decoration object
    return {
        // Set the range of the decoration to the end of the line. ตั้งค่า range ของ decoration ไปยังจุดสิ้นสุดของ line
        range: new vscode.Range(line.range.end, line.range.end),
        // Set the render options for the decoration. ตั้งค่า render options สำหรับ decoration
        renderOptions: { after: { contentText: ` // License: ${depData.license} (${depData.status})` } },
    };
}

/**
 * Adds a decoration to the appropriate array based on the dependency status.
 * @param {object} decoration The decoration to add.
 * @param {object} depData The dependency data.
 * @param {Array<object>} compliant The array of compliant decorations.
 * @param {Array<object>} nonCompliant The array of non-compliant decorations.
 * @param {Array<object>} unknown The array of unknown decorations.
 */
// Adds a decoration to the appropriate array based on the dependency status.
// เพิ่ม decoration ไปยัง array ที่เหมาะสมตามสถานะ dependency
function addDecoration(decoration, depData, compliant, nonCompliant, unknown) {
    // Add the decoration to the appropriate array based on the dependency status. เพิ่ม decoration ไปยัง array ที่เหมาะสมตามสถานะ dependency
    if (depData.status === "compliant") compliant.push(decoration);
    else if (depData.status === "non-compliant") nonCompliant.push(decoration);
    else unknown.push(decoration);
}

/**
 * Parses JSON files and adds decorations for each dependency.
 * @param {vscode.TextDocument} document The document to parse.
 * @param {string} text The text of the document.
 * @param {Map<string, object>} depsMap A map of dependency names to dependency data.
 * @param {Array<object>} compliant The array of compliant decorations.
 * @param {Array<object>} nonCompliant The array of non-compliant decorations.
 * @param {Array<object>} unknown The array of unknown decorations.
 */
// Parses JSON files and adds decorations for each dependency.
// Parse ไฟล์ JSON และเพิ่ม decorations สำหรับแต่ละ dependency
function parseJsonDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    // Parse the JSON tree. Parse JSON tree
    const tree = jsonc.parseTree(text);
    // If the tree is null, return. ถ้า tree เป็น null, ให้ return
    if (!tree) return;
    // Define the dependency sections. กำหนด dependency sections
    const depSections = ["dependencies", "devDependencies", "require", "require-dev"];

    // Iterate over each dependency section. วนซ้ำแต่ละ dependency section
    for (const section of depSections) {
        // Find the dependency node in the tree. ค้นหา dependency node ใน tree
        const depsNode = jsonc.findNodeAtLocation(tree, [section]);
        // If the dependency node exists and is an object, iterate over its children. ถ้า dependency node มีอยู่และเป็น object, ให้วนซ้ำ children ของมัน
        if (depsNode && depsNode.type === 'object' && depsNode.children) {
            // Iterate over each child node. วนซ้ำแต่ละ child node
            depsNode.children.forEach(propNode => {
                // If the child node has children, get the dependency name and data. ถ้า child node มี children, ให้ดึง dependency name และ data
                if (propNode.children && propNode.children.length > 0) {
                    // Get the key node. ดึง key node
                    const keyNode = propNode.children[0];
                    // Get the dependency name. ดึง dependency name
                    const depName = keyNode.value;
                    // Get the dependency data. ดึง dependency data
                    const depData = depsMap.get(depName);
                    // If there is dependency data, create a decoration and add it to the appropriate array. ถ้ามี dependency data, สร้าง decoration และเพิ่มไปยัง array ที่เหมาะสม
                    if (depData) {
                        // Get the line. ดึง line
                        const line = document.lineAt(document.positionAt(keyNode.offset).line);
                        // Create the decoration. สร้าง decoration
                        const decoration = createDecoration(line, depData);
                        // Add the decoration. เพิ่ม decoration
                        addDecoration(decoration, depData, compliant, nonCompliant, unknown);
                    }
                }
            });
        }
    }
}

// --- START: ฟังก์ชันที่แก้ไขใหม่ให้ถูกต้องสมบูรณ์ ---
/**
 * Parses TOML files using a robust regex that handles bare and quoted keys.
 */
// Parses TOML files using a robust regex that handles bare and quoted keys.
// Parse ไฟล์ TOML โดยใช้ regex ที่แข็งแกร่งซึ่งจัดการ bare และ quoted keys
function parseTomlDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    // Split the text into lines. แยก text เป็น lines
    const lines = text.split('\n');
    // Define the dependency sections. กำหนด dependency sections
    const depSections = ["[dependencies]", "[dev-dependencies]", "[build-dependencies]", "[target", "[workspace.dependencies]"];
    // Flag to indicate if we are in a dependency section. แฟล็กเพื่อระบุว่าเราอยู่ใน dependency section หรือไม่
    let inDepSection = false;

    // This regex robustly captures TOML keys. It handles:
    // This regex robustly captures TOML keys. It handles:
    // Regex นี้จับ TOML keys ได้อย่างแข็งแกร่ง มันจัดการ:
    // 1. Quoted keys: "my-key" -> captures `my-key` in group 1
    // 1. Quoted keys: "my-key" -> captures `my-key` in group 1
    // 2. Bare keys: my_key  -> captures `my_key` in group 2
    // 2. Bare keys: my_key  -> captures `my_key` in group 2
    const keyRegex = /^\s*(?:"([^"]+)"|([a-zA-Z0-9_-]+))/;

    // Iterate over each line. วนซ้ำแต่ละ line
    for (let i = 0; i < lines.length; i++) {
        // Trim the line. Trim line
        const trimmedLine = lines[i].trim();
        
        // Ignore full-line comments. ละเว้น full-line comments
        if (trimmedLine.startsWith("#")) continue;

        // If the line starts with a dependency section, set the inDepSection flag to true. ถ้า line ขึ้นต้นด้วย dependency section, ตั้งค่า inDepSection flag เป็น true
        if (depSections.some(s => trimmedLine.startsWith(s))) {
            // Set inDepSection to true. ตั้งค่า inDepSection เป็น true
            inDepSection = true;
            // Continue to the next line. ดำเนินการต่อ line ถัดไป
            continue;
        }

        // If the line starts with a bracket and is not a dependency section, set the inDepSection flag to false. ถ้า line ขึ้นต้นด้วย bracket และไม่ใช่ dependency section, ตั้งค่า inDepSection flag เป็น false
        if (trimmedLine.startsWith("[") && !depSections.some(s => trimmedLine.startsWith(s))) {
            // Set inDepSection to false. ตั้งค่า inDepSection เป็น false
            inDepSection = false;
            // Continue to the next line. ดำเนินการต่อ line ถัดไป
            continue;
        }

        // If we are in a dependency section and the line includes an equals sign, try to match the key regex. ถ้าเราอยู่ใน dependency section และ line มีเครื่องหมายเท่ากับ, ให้ลองจับคู่ key regex
        if (inDepSection && trimmedLine.includes("=")) {
            // Match the key regex. จับคู่ key regex
            const match = trimmedLine.match(keyRegex);
            
            // If there is a match, get the dependency name and data. ถ้ามีการจับคู่, ให้ดึง dependency name และ data
            if (match) {
                // The dependency name will be in either the first or second capture group
                // The dependency name will be in either the first or second capture group
                // Dependency name จะอยู่ใน capture group แรกหรือสอง
                const depName = match[1] || match[2];
                // If there is a dependency name, get the dependency data. ถ้ามี dependency name, ให้ดึง dependency data
                if (depName) {
                    // Get the dependency data. ดึง dependency data
                    const depData = depsMap.get(depName);
                    // If there is dependency data, create a decoration and add it to the appropriate array. ถ้ามี dependency data, สร้าง decoration และเพิ่มไปยัง array ที่เหมาะสม
                    if (depData) {
                        // Get the line. ดึง line
                        const line = document.lineAt(i);
                        // Create the decoration. สร้าง decoration
                        const decoration = createDecoration(line, depData);
                        // Add the decoration. เพิ่ม decoration
                        addDecoration(decoration, depData, compliant, nonCompliant, unknown);
                    }
                }
            }
        }
    }
}
// --- END: ฟังก์ชันที่แก้ไขใหม่ให้ถูกต้องสมบูรณ์ ---

/**
 * Parses files using regex and adds decorations for each dependency.
 * @param {vscode.TextDocument} document The document to parse.
 * @param {string} text The text of the document.
 * @param {Array<object>} relevantDeps The relevant dependencies.
 * @param {Array<object>} compliant The array of compliant decorations.
 * @param {Array<object>} nonCompliant The array of non-compliant decorations.
 * @param {Array<object>} unknown The array of unknown decorations.
 */
// Parses files using regex and adds decorations for each dependency.
// Parse ไฟล์โดยใช้ regex และเพิ่ม decorations สำหรับแต่ละ dependency
function parseRegexDecorations(document, text, relevantDeps, compliant, nonCompliant, unknown) {
    // Iterate over each relevant dependency. วนซ้ำแต่ละ relevant dependency
     relevantDeps.forEach((dep) => {
        // Create a regex for the dependency. This regex looks for the dependency name at the start of a line or after whitespace.
        // สร้าง regex สำหรับ dependency โดยจะมองหาชื่อ dependency ที่จุดเริ่มต้นของบรรทัดหรือหลัง whitespace
        const depRegex = new RegExp(`(^|\\s)${dep.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[=>~\\s]`, "gm");
        // Match the regex against the text. จับคู่ regex กับ text
        let match;
        // While there are matches, create a decoration and add it to the appropriate array. ในขณะที่มี matches, สร้าง decoration และเพิ่มไปยัง array ที่เหมาะสม
        while ((match = depRegex.exec(text)) !== null) {
            // Get the position of the match. ดึงตำแหน่งของ match
            const position = document.positionAt(match.index);
            // Get the line. ดึง line
            const line = document.lineAt(position.line);
            // Create the decoration. สร้าง decoration
            const decoration = createDecoration(line, dep);
            // Add the decoration. เพิ่ม decoration
            addDecoration(decoration, dep, compliant, nonCompliant, unknown);
        }
    });
}

/**
 * Provides hover information for dependencies.
 */
// Provides hover information for dependencies.
// ให้ข้อมูล hover สำหรับ dependencies
class DependencyHoverProvider {
    /**
     * Constructor for the DependencyHoverProvider class.
     */
    // Constructor สำหรับคลาส DependencyHoverProvider
    constructor() {
      // Initialize the dependency data. เริ่มต้น dependency data
      this.dependencyData = [];
    }
    /**
     * Updates the dependency data.
     * @param {Array<object>} data The dependency data.
     */
    // Updates the dependency data.
    // อัปเดต dependency data
    updateData(data) {
      // Set the dependency data. ตั้งค่า dependency data
      this.dependencyData = data || [];
    }
  
    /**
     * Provides hover information for the given document and position.
     * @param {vscode.TextDocument} document The document to provide hover information for.
     * @param {vscode.Position} position The position to provide hover information for.
     * @returns {vscode.Hover | null} The hover information, or null if no hover information is available.
     */
    // Provides hover information for the given document and position.
    // ให้ข้อมูล hover สำหรับ document และ position ที่กำหนด
    provideHover(document, position) {
      // Get the relative path of the document. ดึง relative path ของ document
      const relativePath = vscode.workspace.asRelativePath(document.uri, false);
      // Filter the dependencies to only include those that are in the current document. กรอง dependencies เพื่อให้มีเฉพาะ dependencies ที่อยู่ใน document ปัจจุบัน
      const relevantDeps = this.dependencyData.filter(d => d.manifestFile === relativePath);
      // If there are no relevant dependencies, return null. ถ้าไม่มี relevant dependencies, ให้ return null
      if(relevantDeps.length === 0) return null;
  
      // Get the line content to check for dependency names.
      // ดึงเนื้อหาของบรรทัดเพื่อตรวจสอบชื่อ dependency
      const line = document.lineAt(position.line).text;

      // Find which relevant dependency name appears in the current line
      // ค้นหาว่าชื่อ dependency ใดที่เกี่ยวข้องปรากฏในบรรทัดปัจจุบัน
      const depData = relevantDeps.find(d => {
          // Use a simple regex to find the package name as a whole word to avoid partial matches (e.g., 'react' in 'react-dom')
          // ใช้ regex ง่ายๆ เพื่อค้นหาชื่อแพ็กเกจเป็นคำเต็มเพื่อหลีกเลี่ยงการจับคู่บางส่วน (เช่น 'react' ใน 'react-dom')
          const regex = new RegExp(`\\b${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          return regex.test(line);
      });
      
  
      // If there is dependency data, create the hover content and return a new hover object. ถ้ามี dependency data, สร้าง hover content และ return hover object ใหม่
      if (depData) {
        // Create the hover content. สร้าง hover content
        const content = new vscode.MarkdownString();
        // Set the content to be trusted. ตั้งค่า content ให้เป็น trusted
        content.isTrusted = true;
        // Append the dependency name to the content. ผนวก dependency name ไปยัง content
        content.appendMarkdown(`**LicenseSentinel: ${depData.name}**\n\n`);
        // Append the dependency version to the content. ผนวก dependency version ไปยัง content
        content.appendMarkdown(`- **Version:** \`${depData.version}\`\n`);
        // Append the dependency license to the content. ผนวก dependency license ไปยัง content
        content.appendMarkdown(`- **License:** \`${depData.license}\`\n`);
        // Define icons for each status. กำหนด icons สำหรับแต่ละสถานะ
        const icons = { compliant: "✅", "non-compliant": "❌", unknown: "❓" };
        // Append the dependency status to the content. ผนวก dependency status ไปยัง content
        content.appendMarkdown(
          `- **Status:** ${icons[depData.status] || '❓'} \`${depData.status}\`\n\n`
        );
        // If there is a homepage, append a link to the homepage to the content. ถ้ามี homepage, ผนวก link ไปยัง homepage ไปยัง content
        if (depData.homepage) {
          // Append the link to the homepage to the content. ผนวก link ไปยัง homepage ไปยัง content
          content.appendMarkdown(`[Go to Homepage](${depData.homepage})`);
        }
        // Return a new hover object for the entire line
        // คืนค่า hover object ใหม่สำหรับทั้งบรรทัด
        return new vscode.Hover(content);
      }
      // If there is no dependency data, return null. ถ้าไม่มี dependency data, ให้ return null
      return null;
    }
}
  
// Export the updateDecorations and DependencyHoverProvider functions. ส่งออกฟังก์ชัน updateDecorations และ DependencyHoverProvider
module.exports = { updateDecorations, DependencyHoverProvider };