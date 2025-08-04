// --- START OF FILE src/features/decorations.js (FINAL & COMPLETE) ---

const vscode = require("vscode");
const jsonc = require("jsonc-parser");

// Decoration styles for different compliance statuses.
const compliantDecorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.addedResourceForeground") },
});
const nonCompliantDecorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.deletedResourceForeground"), fontWeight: "bold" },
});
const unknownDecorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.modifiedResourceForeground") },
});

/**
 * Updates the decorations in the editor to show license compliance status.
 * @param {vscode.TextEditor} editor The editor to update.
 * @param {Array<object>} allDependencies All dependencies in the workspace.
 */
function updateDecorations(editor, allDependencies) {
    if (!editor || allDependencies.length === 0) return;

    const document = editor.document;
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    const relevantDeps = allDependencies.filter(
        (dep) => dep.manifestFile === relativePath
    );

    const compliantDecorations = [];
    const nonCompliantDecorations = [];
    const unknownDecorations = [];

    // Clear decorations if no relevant dependencies are found for this file.
    if (relevantDeps.length === 0) {
        editor.setDecorations(compliantDecorationType, []);
        editor.setDecorations(nonCompliantDecorationType, []);
        editor.setDecorations(unknownDecorationType, []);
        return;
    }

    const text = document.getText();
    const depsMap = new Map(relevantDeps.map(d => [d.name, d]));
    const fileLang = document.languageId;

    // Route to a specific parser based on file language to improve accuracy and prevent duplicates.
    if (fileLang === 'json' || fileLang === 'jsonc') {
        parseJsonDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else if (fileLang === 'toml') {
        parseTomlDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else if (fileLang === 'pip-requirements') {
        parseRequirementsDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else {
        // Fallback for other file types like go.mod which are line-based.
        parseRegexDecorations(document, text, relevantDeps, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    }

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
function createDecoration(line, depData) {
    return {
        range: new vscode.Range(line.range.end, line.range.end),
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
function addDecoration(decoration, depData, compliant, nonCompliant, unknown) {
    if (depData.status === "compliant") compliant.push(decoration);
    else if (depData.status === "non-compliant") nonCompliant.push(decoration);
    else unknown.push(decoration);
}

/**
 * Parses JSON files and adds decorations for each dependency.
 */
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

/**
 * Parses TOML files using a robust regex that handles bare and quoted keys.
 */
function parseTomlDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    const lines = text.split('\n');
    const depSections = ["[dependencies]", "[dev-dependencies]", "[build-dependencies]", "[target", "[workspace.dependencies]"];
    let inDepSection = false;
    const keyRegex = /^\s*(?:"([^"]+)"|([a-zA-Z0-9_.-]+))/;

    for (let i = 0; i < lines.length; i++) {
        const lineWithoutComment = lines[i].split('#')[0];
        const trimmedLine = lineWithoutComment.trim();
        
        if (trimmedLine === "") continue;

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

/**
 * Parses requirements.txt files and adds decorations.
 */
function parseRequirementsDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    const lines = text.split(/\r?\n/);
    const depRegex = /^\s*([a-zA-Z0-9_.-]+)/;

    lines.forEach((lineContent, index) => {
        const trimmedLine = lineContent.trim();
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
            return;
        }

        const match = trimmedLine.match(depRegex);
        if (match && match[1]) {
            const depName = match[1].split('[')[0]; // Handle extras like [full]
            const depData = depsMap.get(depName);

            if (depData) {
                const line = document.lineAt(index);
                const decoration = createDecoration(line, depData);
                addDecoration(decoration, depData, compliant, nonCompliant, unknown);
            }
        }
    });
}

/**
 * Parses files using a simple regex for line-based formats like go.mod.
 */
function parseRegexDecorations(document, text, relevantDeps, compliant, nonCompliant, unknown) {
     relevantDeps.forEach((dep) => {
        const depRegex = new RegExp(`^\\s*${dep.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, "m");
        const match = text.match(depRegex);
        
        if (match) {
            const position = document.positionAt(match.index);
            const line = document.lineAt(position.line);
            const decoration = createDecoration(line, dep);
            addDecoration(decoration, dep, compliant, nonCompliant, unknown);
        }
    });
}

/**
 * Provides hover information for dependencies.
 */
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
  
      const range = document.getWordRangeAtPosition(position, /"([^"]+)"/) || document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.-]+/);
      if (!range) return null;
  
      const hoveredWord = document.getText(range).replace(/"/g, "").split('[')[0];
      const depData = relevantDeps.find((d) => d.name === hoveredWord);
  
      if (depData) {
        const content = new vscode.MarkdownString();
        content.isTrusted = true;
        content.appendMarkdown(`**LicenseSentinel: ${depData.name}**\n\n`);
        content.appendMarkdown(`- **Version:** \`${depData.version}\`\n`);
        content.appendMarkdown(`- **License:** \`${depData.license}\`\n`);
        const icons = { compliant: "✅", "non-compliant": "❌", unknown: "❓" };
        content.appendMarkdown(
          `- **Status:** ${icons[depData.status] || '❓'} \`${depData.status}\`\n`
        );
        content.appendMarkdown(`- **Reason:** *${depData.analysis.reason}*\n\n`);

        if (depData.analysis.obligations.length > 0) {
            content.appendMarkdown(`**Key Obligations:**\n`);
            depData.analysis.obligations.forEach(ob => {
                const riskIcon = ob.risk === 'high' ? '$(error)' : (ob.risk === 'medium' ? '$(warning)' : '$(info)');
                content.appendMarkdown(`- ${riskIcon} ${ob.summary}\n`);
            });
            content.appendMarkdown('\n');
        }

        if (depData.homepage) {
          content.appendMarkdown(`[Go to Homepage](${depData.homepage})`);
        }
        return new vscode.Hover(content, range);
      }
      return null;
    }
}
  
module.exports = { updateDecorations, DependencyHoverProvider };
// --- END OF FILE src/features/decorations.js (FINAL & COMPLETE) ---