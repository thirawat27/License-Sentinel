const vscode = require("vscode");
const jsonc = require("jsonc-parser");

// Decoration styles (ไม่มีการเปลี่ยนแปลง)
const compliantDecorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.addedResourceForeground") },
});
const nonCompliantDecorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.deletedResourceForeground"), fontWeight: "bold" },
});
const unknownDecorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.modifiedResourceForeground") },
});

function updateDecorations(editor, allDependencies) {
    if (!editor || allDependencies.length === 0) return;

    const document = editor.document;
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    const relevantDeps = allDependencies.filter(
        (dep) => dep.manifestFile === relativePath
    );

    if (relevantDeps.length === 0) {
        editor.setDecorations(compliantDecorationType, []);
        editor.setDecorations(nonCompliantDecorationType, []);
        editor.setDecorations(unknownDecorationType, []);
        return;
    }

    const compliantDecorations = [];
    const nonCompliantDecorations = [];
    const unknownDecorations = [];

    const text = document.getText();
    const depsMap = new Map(relevantDeps.map(d => [d.name, d]));

    const fileLang = document.languageId;

    if (fileLang === 'json' || fileLang === 'jsonc') {
        parseJsonDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else if (fileLang === 'toml') {
        parseTomlDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else {
        parseRegexDecorations(document, text, relevantDeps, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    }

    editor.setDecorations(compliantDecorationType, compliantDecorations);
    editor.setDecorations(nonCompliantDecorationType, nonCompliantDecorations);
    editor.setDecorations(unknownDecorationType, unknownDecorations);
}

function createDecoration(line, depData) {
    return {
        range: new vscode.Range(line.range.end, line.range.end),
        renderOptions: { after: { contentText: ` // License: ${depData.license} (${depData.status})` } },
    };
}

function addDecoration(decoration, depData, compliant, nonCompliant, unknown) {
    if (depData.status === "compliant") compliant.push(decoration);
    else if (depData.status === "non-compliant") nonCompliant.push(decoration);
    else unknown.push(decoration);
}

function parseJsonDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    const tree = jsonc.parseTree(text);
    if (!tree) return;
    const depSections = ["dependencies", "devDependencies", "require", "require-dev"];

    for (const section of depSections) {
        const depsNode = jsonc.findNodeAtLocation(tree, [section]);
        if (depsNode && depsNode.type === 'object' && depsNode.children) {
            depsNode.children.forEach(propNode => {
                if (propNode.children && propNode.children.length > 0) {
                    const keyNode = propNode.children[0];
                    const depName = keyNode.value;
                    const depData = depsMap.get(depName);
                    if (depData) {
                        const line = document.lineAt(document.positionAt(keyNode.offset).line);
                        const decoration = createDecoration(line, depData);
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
function parseTomlDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    const lines = text.split('\n');
    const depSections = ["[dependencies]", "[dev-dependencies]", "[build-dependencies]", "[target", "[workspace.dependencies]"];
    let inDepSection = false;

    // This regex robustly captures TOML keys. It handles:
    // 1. Quoted keys: "my-key" -> captures `my-key` in group 1
    // 2. Bare keys: my_key  -> captures `my_key` in group 2
    const keyRegex = /^\s*(?:"([^"]+)"|([a-zA-Z0-9_-]+))/;

    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        
        if (trimmedLine.startsWith("#")) continue; // Ignore full-line comments

        if (depSections.some(s => trimmedLine.startsWith(s))) {
            inDepSection = true;
            continue;
        }

        if (trimmedLine.startsWith("[") && !depSections.some(s => trimmedLine.startsWith(s))) {
            inDepSection = false;
            continue;
        }

        if (inDepSection && trimmedLine.includes("=")) {
            const match = trimmedLine.match(keyRegex);
            
            if (match) {
                // The dependency name will be in either the first or second capture group
                const depName = match[1] || match[2];
                if (depName) {
                    const depData = depsMap.get(depName);
                    if (depData) {
                        const line = document.lineAt(i);
                        const decoration = createDecoration(line, depData);
                        addDecoration(decoration, depData, compliant, nonCompliant, unknown);
                    }
                }
            }
        }
    }
}
// --- END: ฟังก์ชันที่แก้ไขใหม่ให้ถูกต้องสมบูรณ์ ---


function parseRegexDecorations(document, text, relevantDeps, compliant, nonCompliant, unknown) {
     relevantDeps.forEach((dep) => {
        const depRegex = new RegExp(`^\\s*${dep.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`, "gm");
        let match;
        while ((match = depRegex.exec(text)) !== null) {
            const position = document.positionAt(match.index);
            const line = document.lineAt(position.line);
            const decoration = createDecoration(line, dep);
            addDecoration(decoration, dep, compliant, nonCompliant, unknown);
        }
    });
}

class DependencyHoverProvider {
    constructor() {
      this.dependencyData = [];
    }
    updateData(data) {
      this.dependencyData = data || [];
    }
  
    provideHover(document, position) {
      const relativePath = vscode.workspace.asRelativePath(document.uri, false);
      const relevantDeps = this.dependencyData.filter(d => d.manifestFile === relativePath);
      if(relevantDeps.length === 0) return null;
  
      const range = document.getWordRangeAtPosition(position, /"([^"]+)"/) || document.getWordRangeAtPosition(position, /[a-zA-Z0-9_-]+/);
      if (!range) return null;
  
      const hoveredWord = document.getText(range).replace(/"/g, "");
      const depData = relevantDeps.find((d) => d.name === hoveredWord);
  
      if (depData) {
        const content = new vscode.MarkdownString();
        content.isTrusted = true;
        content.appendMarkdown(`**LicenseSentinel: ${depData.name}**\n\n`);
        content.appendMarkdown(`- **Version:** \`${depData.version}\`\n`);
        content.appendMarkdown(`- **License:** \`${depData.license}\`\n`);
        const icons = { compliant: "✅", "non-compliant": "❌", unknown: "❓" };
        content.appendMarkdown(
          `- **Status:** ${icons[depData.status] || '❓'} \`${depData.status}\`\n\n`
        );
        if (depData.homepage) {
          content.appendMarkdown(`[Go to Homepage](${depData.homepage})`);
        }
        return new vscode.Hover(content, range);
      }
      return null;
    }
}
  
module.exports = { updateDecorations, DependencyHoverProvider };