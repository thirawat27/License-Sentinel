// This file handles the display of license information directly in the VS Code editor, using "decorations" to highlight dependencies and their compliance status.

const vscode = require("vscode");
const jsonc = require("jsonc-parser");

// Define the visual styles for the decorations based on the license compliance status.
const compliantDecorationType = vscode.window.createTextEditorDecorationType({
    // Style for dependencies with compliant licenses (e.g., green color).
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.addedResourceForeground") },
});
const nonCompliantDecorationType = vscode.window.createTextEditorDecorationType({
    // Style for dependencies with non-compliant licenses (e.g., red color, bold text).
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.deletedResourceForeground"), fontWeight: "bold" },
});
const unknownDecorationType = vscode.window.createTextEditorDecorationType({
    // Style for dependencies with unknown licenses (e.g., yellow color).
    after: { margin: "0 0 0 1.5rem", color: new vscode.ThemeColor("gitDecoration.modifiedResourceForeground") },
});

/**
 * Updates the decorations in the editor to show license compliance status.
 * This function is the main entry point for applying decorations to the editor.
 * @param {vscode.TextEditor} editor The VS Code editor to update.
 * @param {Array<object>} allDependencies All dependencies in the workspace, obtained from the license scanning process.
 */
function updateDecorations(editor, allDependencies) {
    // If there's no active editor or no dependency data, exit early to avoid errors.
    if (!editor || allDependencies.length === 0) return;

    // Get the document (file) that's currently open in the editor.
    const document = editor.document;
    // Determine the relative path of the document within the workspace.
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    // Filter the dependencies to find only those that are defined in the current file (manifest file).
    const relevantDeps = allDependencies.filter(
        (dep) => dep.manifestFile === relativePath
    );

    // Initialize arrays to hold the decoration objects for each compliance status.
    const compliantDecorations = [];
    const nonCompliantDecorations = [];
    const unknownDecorations = [];

    // If no relevant dependencies are found for this file, clear any existing decorations and exit.
    if (relevantDeps.length === 0) {
        editor.setDecorations(compliantDecorationType, []);
        editor.setDecorations(nonCompliantDecorationType, []);
        editor.setDecorations(unknownDecorationType, []);
        return;
    }

    // Get the entire text content of the document.
    const text = document.getText();
    // Create a Map (key-value store) for quick lookup of dependencies by name.
    const depsMap = new Map(relevantDeps.map(d => [d.name, d]));
    // Get the language ID of the current file (e.g., 'json', 'toml', 'javascript').
    const fileLang = document.languageId;

    // Route to a specific parser based on file language to improve accuracy and prevent duplicates.
    if (fileLang === 'json' || fileLang === 'jsonc') {
        // For JSON and JSON with comments (JSONC) files, use the JSON parser.
        parseJsonDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else if (fileLang === 'toml') {
        // For TOML files, use the TOML parser.
        parseTomlDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else if (fileLang === 'pip-requirements') {
        // For Python requirements.txt files, use the requirements.txt parser.
        parseRequirementsDecorations(document, text, depsMap, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    } else {
        // Fallback for other file types like go.mod which are line-based.
        parseRegexDecorations(document, text, relevantDeps, compliantDecorations, nonCompliantDecorations, unknownDecorations);
    }

    // Apply the decorations to the editor, using the defined decoration types for each status.
    editor.setDecorations(compliantDecorationType, compliantDecorations);
    editor.setDecorations(nonCompliantDecorationType, nonCompliantDecorations);
    editor.setDecorations(unknownDecorationType, unknownDecorations);
}

/**
 * Creates a decoration object for a given line and dependency data.
 * This function generates the actual decoration that will be displayed in the editor.
 * @param {vscode.TextLine} line The line of code to decorate.
 * @param {object} depData The dependency data, including license and status.
 * @returns {object} The decoration object, ready to be applied to the editor.
 */
function createDecoration(line, depData) {
    // Create a decoration that adds text after the end of the line, showing the license and status.
    return {
        range: new vscode.Range(line.range.end, line.range.end),
        renderOptions: { after: { contentText: ` // License: ${depData.license} (${depData.status})` } },
    };
}

/**
 * Adds a decoration to the appropriate array based on the dependency status.
 * This function sorts the decorations into the correct array based on whether the dependency is compliant, non-compliant, or unknown.
 * @param {object} decoration The decoration object to add.
 * @param {object} depData The dependency data.
 * @param {Array<object>} compliant The array of compliant decorations.
 * @param {Array<object>} nonCompliant The array of non-compliant decorations.
 * @param {Array<object>} unknown The array of unknown decorations.
 */
function addDecoration(decoration, depData, compliant, nonCompliant, unknown) {
    // Add the decoration to the appropriate array based on the dependency's compliance status.
    if (depData.status === "compliant") compliant.push(decoration);
    else if (depData.status === "non-compliant") nonCompliant.push(decoration);
    else unknown.push(decoration);
}

/**
 * Parses JSON files and adds decorations for each dependency.
 * This function uses the jsonc-parser to accurately locate dependencies in JSON files, even with comments.
 * @param {vscode.TextDocument} document The VS Code document object.
 * @param {string} text The text content of the document.
 * @param {Map<string, object>} depsMap A map of dependency names to dependency data.
 * @param {Array<object>} compliant The array of compliant decorations.
 * @param {Array<object>} nonCompliant The array of non-compliant decorations.
 * @param {Array<object>} unknown The array of unknown decorations.
 */
function parseJsonDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    // Parse the JSON text into a tree structure, allowing for comments.
    const tree = jsonc.parseTree(text);
    // If parsing fails (e.g., invalid JSON), exit.
    if (!tree) return;
    // Define the sections in package.json where dependencies are listed.
    const depSections = ["dependencies", "devDependencies", "require", "require-dev"];

    // Iterate over each dependency section.
    for (const section of depSections) {
        // Find the node in the tree corresponding to the current dependency section.
        const depsNode = jsonc.findNodeAtLocation(tree, [section]);
        // Check if the node exists, is an object, and has children (i.e., dependencies).
        if (depsNode && depsNode.type === 'object' && depsNode.children) {
            // Iterate over each property (dependency) in the section.
            depsNode.children.forEach(propNode => {
                // A property node has two children: key (name) and value (version).
                if (propNode.children && propNode.children.length > 0) {
                    // The first child is the key (dependency name).
                    const keyNode = propNode.children[0];
                    // Extract the dependency name from the key node.
                    const depName = keyNode.value;
                    // Look up the dependency data in the depsMap.
                    const depData = depsMap.get(depName);
                    // If the dependency is found in the map.
                    if (depData) {
                        // Get the line of code where the dependency is defined.
                        const line = document.lineAt(document.positionAt(keyNode.offset).line);
                        // Create a decoration object for the line.
                        const decoration = createDecoration(line, depData);
                        // Add the decoration to the appropriate array based on the dependency's status.
                        addDecoration(decoration, depData, compliant, nonCompliant, unknown);
                    }
                }
            });
        }
    }
}

/**
 * Parses TOML files using a robust regex that handles bare and quoted keys.
 * This function is designed to accurately identify dependencies in TOML files, which can have a variety of key formats.
 * @param {vscode.TextDocument} document The VS Code document object.
 * @param {string} text The text content of the document.
 * @param {Map<string, object>} depsMap A map of dependency names to dependency data.
 * @param {Array<object>} compliant The array of compliant decorations.
 * @param {Array<object>} nonCompliant The array of non-compliant decorations.
 * @param {Array<object>} unknown The array of unknown decorations.
 */
function parseTomlDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    // Split the TOML text into individual lines.
    const lines = text.split('\n');
    // Define the sections in TOML files where dependencies are listed.
    const depSections = ["[dependencies]", "[dev-dependencies]", "[build-dependencies]", "[target", "[workspace.dependencies]"];
    // Flag to indicate whether the current line is within a dependency section.
    let inDepSection = false;
    // Regular expression to extract the dependency name from a line, handling both quoted and unquoted keys.
    const keyRegex = /^\s*(?:"([^"]+)"|([a-zA-Z0-9_.-]+))/;

    // Iterate over each line in the TOML file.
    for (let i = 0; i < lines.length; i++) {
        // Remove any comments from the line.
        const lineWithoutComment = lines[i].split('#')[0];
        // Trim whitespace from the beginning and end of the line.
        const trimmedLine = lineWithoutComment.trim();
        
        // Skip empty lines.
        if (trimmedLine === "") continue;

        // Check if the line starts a dependency section.
        if (depSections.some(s => trimmedLine.startsWith(s))) {
            inDepSection = true;
            continue;
        }

        // If the line starts a new section (not a dependency section), reset the flag.
        if (trimmedLine.startsWith("[") && !depSections.some(s => trimmedLine.startsWith(s))) {
            inDepSection = false;
            continue;
        }

        // If inside a dependency section and the line contains an equals sign (indicating a key-value pair).
        if (inDepSection && trimmedLine.includes("=")) {
            // Attempt to match the line against the dependency key regex.
            const match = trimmedLine.match(keyRegex);
            
            // If a match is found.
            if (match) {
                // Extract the dependency name, handling both quoted and unquoted keys.
                const depName = match[1] || match[2];
                // If a dependency name is found.
                if (depName) {
                    // Look up the dependency data in the depsMap.
                    const depData = depsMap.get(depName);
                    // If the dependency is found in the map.
                    if (depData) {
                        // Get the line of code where the dependency is defined.
                        const line = document.lineAt(i);
                        // Create a decoration object for the line.
                        const decoration = createDecoration(line, depData);
                        // Add the decoration to the appropriate array based on the dependency's status.
                        addDecoration(decoration, depData, compliant, nonCompliant, unknown);
                    }
                }
            }
        }
    }
}

/**
 * Parses requirements.txt files and adds decorations.
 * This function is tailored to the specific format of Python requirements.txt files.
 * @param {vscode.TextDocument} document The VS Code document object.
 * @param {string} text The text content of the document.
 * @param {Map<string, object>} depsMap A map of dependency names to dependency data.
 * @param {Array<object>} compliant The array of compliant decorations.
 * @param {Array<object>} nonCompliant The array of non-compliant decorations.
 * @param {Array<object>} unknown The array of unknown decorations.
 */
function parseRequirementsDecorations(document, text, depsMap, compliant, nonCompliant, unknown) {
    // Split the requirements.txt text into individual lines.
    const lines = text.split(/\r?\n/);
    // Regular expression to extract the dependency name from a line.
    const depRegex = /^\s*([a-zA-Z0-9_.-]+)/;

    // Iterate over each line in the requirements.txt file.
    lines.forEach((lineContent, index) => {
        // Trim whitespace from the beginning and end of the line.
        const trimmedLine = lineContent.trim();
        // Skip comments and empty lines.
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
            return;
        }

        // Attempt to match the line against the dependency regex.
        const match = trimmedLine.match(depRegex);
        // If a match is found.
        if (match && match[1]) {
            // Extract the dependency name, handling "extras" like [full].
            const depName = match[1].split('[')[0]; // Handle extras like [full]
            // Look up the dependency data in the depsMap.
            const depData = depsMap.get(depName);

            // If the dependency is found in the map.
            if (depData) {
                // Get the line of code where the dependency is defined.
                const line = document.lineAt(index);
                // Create a decoration object for the line.
                const decoration = createDecoration(line, depData);
                // Add the decoration to the appropriate array based on the dependency's status.
                addDecoration(decoration, depData, compliant, nonCompliant, unknown);
            }
        }
    });
}

/**
 * Parses files using a simple regex for line-based formats like go.mod.
 * This function is a fallback for file types that don't have a more specific parser.
 * @param {vscode.TextDocument} document The VS Code document object.
 * @param {string} text The text content of the document.
 * @param {Array<object>} relevantDeps An array of relevant dependencies for the current file.
 * @param {Array<object>} compliant The array of compliant decorations.
 * @param {Array<object>} nonCompliant The array of non-compliant decorations.
 * @param {Array<object>} unknown The array of unknown decorations.
 */
function parseRegexDecorations(document, text, relevantDeps, compliant, nonCompliant, unknown) {
     // Iterate over each relevant dependency.
     relevantDeps.forEach((dep) => {
        // Create a regex to find the dependency name at the beginning of a line.
        const depRegex = new RegExp(`^\\s*${dep.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, "m");
        // Attempt to match the regex in the text.
        const match = text.match(depRegex);
        
        // If a match is found.
        if (match) {
            // Get the position of the match.
            const position = document.positionAt(match.index);
            // Get the line of code where the dependency is defined.
            const line = document.lineAt(position.line);
            // Create a decoration object for the line.
            const decoration = createDecoration(line, dep);
            // Add the decoration to the appropriate array based on the dependency's status.
            addDecoration(decoration, dep, compliant, nonCompliant, unknown);
        }
    });
}

/**
 * Provides hover information for dependencies.
 * This class implements the VS Code HoverProvider API to show detailed information about dependencies when the user hovers over them.
 */
class DependencyHoverProvider {
    constructor() {
      // Initialize the dependency data array.
      this.dependencyData = [];
    }
    /**
     * Updates the dependency data used by the hover provider.
     * @param {Array<object>} data The array of dependency objects.
     */
    updateData(data) {
      // Update the dependency data with the provided data, or an empty array if no data is provided.
      this.dependencyData = data || [];
    }
  
    /**
     * Provides hover information for the item at the given position in the document.
     * @param {vscode.TextDocument} document The document in which the hover is occurring.
     * @param {vscode.Position} position The position at which the hover is occurring.
     * @returns {vscode.Hover | null} A Hover object containing the hover information, or null if no information is available.
     */
    provideHover(document, position) {
      // Determine the relative path of the document within the workspace.
      const relativePath = vscode.workspace.asRelativePath(document.uri, false);
      // Filter the dependencies to find only those that are defined in the current file (manifest file).
      const relevantDeps = this.dependencyData.filter(d => d.manifestFile === relativePath);
      // If no relevant dependencies are found for this file, return null.
      if(relevantDeps.length === 0) return null;
  
      // Get the range of the word at the current position, using either double quotes or alphanumeric characters.
      const range = document.getWordRangeAtPosition(position, /"([^"]+)"/) || document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.-]+/);
      // If no word is found at the current position, return null.
      if (!range) return null;
  
      // Extract the hovered word from the document, removing any quotes and "extras".
      const hoveredWord = document.getText(range).replace(/"/g, "").split('[')[0];
      // Find the dependency data for the hovered word.
      const depData = relevantDeps.find((d) => d.name === hoveredWord);
  
      // If dependency data is found for the hovered word.
      if (depData) {
        // Create a MarkdownString to hold the hover content.
        const content = new vscode.MarkdownString();
        // Allow the MarkdownString to render untrusted content, such as links.
        content.isTrusted = true;
        // Add a title to the hover content.
        content.appendMarkdown(`**LicenseSentinel: ${depData.name}**\n\n`);
        // Add the dependency version to the hover content.
        content.appendMarkdown(`- **Version:** \`${depData.version}\`\n`);
        // Add the dependency license to the hover content.
        content.appendMarkdown(`- **License:** \`${depData.license}\`\n`);
        // Define icons for each compliance status.
        const icons = { compliant: "✅", "non-compliant": "❌", unknown: "❓" };
        // Add the dependency status to the hover content, using the appropriate icon.
        content.appendMarkdown(
          `- **Status:** ${icons[depData.status] || '❓'} \`${depData.status}\`\n`
        );
        // Add the reason for the dependency's status to the hover content.
        content.appendMarkdown(`- **Reason:** *${depData.analysis.reason}*\n\n`);

        // If the dependency has key obligations, add them to the hover content.
        if (depData.analysis.obligations.length > 0) {
            // Add a title for the key obligations section.
            content.appendMarkdown(`**Key Obligations:**\n`);
            // Iterate over each obligation and add it to the hover content.
            depData.analysis.obligations.forEach(ob => {
                // Define icons for each risk level.
                const riskIcon = ob.risk === 'high' ? '$(error)' : (ob.risk === 'medium' ? '$(warning)' : '$(info)');
                // Add the obligation summary to the hover content, using the appropriate risk icon.
                content.appendMarkdown(`- ${riskIcon} ${ob.summary}\n`);
            });
            // Add a newline after the key obligations section.
            content.appendMarkdown('\n');
        }

        // If the dependency has a homepage, add a link to it in the hover content.
        if (depData.homepage) {
          // Add a link to the dependency's homepage.
          content.appendMarkdown(`[Go to Homepage](${depData.homepage})`);
        }
        // Create a new Hover object with the content and range.
        return new vscode.Hover(content, range);
      }
      // If no dependency data is found for the hovered word, return null.
      return null;
    }
}
  
// Export the updateDecorations function and the DependencyHoverProvider class so they can be used in other modules.
module.exports = { updateDecorations, DependencyHoverProvider };