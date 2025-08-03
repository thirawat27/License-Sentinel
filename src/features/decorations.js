const vscode = require("vscode");
const jsonc = require("jsonc-parser"); // <-- นำเข้า jsonc-parser

const compliantDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 1.5rem",
    color: new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
  },
});
const nonCompliantDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 1.5rem",
    color: new vscode.ThemeColor("gitDecoration.deletedResourceForeground"),
    fontWeight: "bold",
  },
  textDecoration: "underline wavy var(--vscode-editorError-foreground)",
});
const unknownDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 1.5rem",
    color: new vscode.ThemeColor("gitDecoration.modifiedResourceForeground"),
  },
});

function updateDecorations(editor, allDependencies) {
  if (!editor || allDependencies.length === 0) return;

  const manifestFileName = editor.document.fileName.split(/\/|\\/).pop();
  const relevantDeps = allDependencies.filter(
    (dep) => dep.manifestFile === manifestFileName
  );
  if (relevantDeps.length === 0) return;

  const compliantDecorations = [];
  const nonCompliantDecorations = [];
  const unknownDecorations = [];
  
  // ตรวจสอบว่าเป็นไฟล์ JSON หรือไม่
  if (manifestFileName.endsWith('.json')) {
      const text = editor.document.getText();
      const tree = jsonc.parseTree(text);
      if (!tree) return;

      const depNodes = ["dependencies", "devDependencies", "require", "require-dev"];
      
      for(const nodeName of depNodes) {
          const depsNode = jsonc.findNodeAtLocation(tree, [nodeName]);
          if (depsNode && depsNode.children) {
              depsNode.children.forEach(childNode => {
                  const depNameNode = childNode.children[0];
                  const depName = depNameNode.value;
                  const depData = relevantDeps.find(d => d.name === depName);

                  if (depData) {
                      const position = editor.document.positionAt(depNameNode.offset);
                      const line = editor.document.lineAt(position.line);
                      const decoration = {
                          range: new vscode.Range(line.range.end, line.range.end),
                          renderOptions: { after: { contentText: `// ${depData.license}` } },
                      };

                      if (depData.status === "compliant") compliantDecorations.push(decoration);
                      else if (depData.status === "non-compliant") nonCompliantDecorations.push(decoration);
                      else unknownDecorations.push(decoration);
                  }
              });
          }
      }
  } else {
      // ใช้ Regex แบบเดิมสำหรับไฟล์ประเภทอื่น
      const text = editor.document.getText();
      relevantDeps.forEach((dep) => {
          const depRegex = new RegExp(`"${dep.name}"\\s*:\\s*".*?"`, "g");
          let match;
          while ((match = depRegex.exec(text)) !== null) {
              const position = editor.document.positionAt(match.index);
              const line = editor.document.lineAt(position.line);
              const decoration = {
                  range: new vscode.Range(line.range.end, line.range.end),
                  renderOptions: { after: { contentText: `// ${dep.license}` } },
              };

              if (dep.status === "compliant") compliantDecorations.push(decoration);
              else if (dep.status === "non-compliant") nonCompliantDecorations.push(decoration);
              else unknownDecorations.push(decoration);
          }
      });
  }

  editor.setDecorations(compliantDecorationType, compliantDecorations);
  editor.setDecorations(nonCompliantDecorationType, nonCompliantDecorations);
  editor.setDecorations(unknownDecorationType, unknownDecorations);
}

class DependencyHoverProvider {
  constructor() {
    this.dependencyData = [];
  }
  updateData(data) {
    this.dependencyData = data;
  }

  provideHover(document, position) {
    const manifestFileName = document.fileName.split(/\/|\\/).pop();
    if (!["package.json", "composer.json"].includes(manifestFileName)) return;

    const range = document.getWordRangeAtPosition(position, /"([^"]+)"/);
    if (!range) return;

    const hoveredWord = document.getText(range).replace(/"/g, "");
    const depData = this.dependencyData.find((d) => d.name === hoveredWord);

    if (depData) {
      const content = new vscode.MarkdownString();
      content.isTrusted = true;
      content.appendMarkdown(`**LicenseSentinel: ${depData.name}**\n\n`);
      content.appendMarkdown(`- **Version:** \`${depData.version}\`\n`);
      content.appendMarkdown(`- **License:** \`${depData.license}\`\n`);
      const icons = { compliant: "✅", "non-compliant": "❌", unknown: "❓" };
      content.appendMarkdown(
        `- **Status:** ${icons[depData.status]} \`${depData.status}\`\n\n`
      );
      if (depData.homepage)
        content.appendMarkdown(`[Go to Homepage](${depData.homepage})`);
      return new vscode.Hover(content, range);
    }
    return null;
  }
}

module.exports = { updateDecorations, DependencyHoverProvider };