import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

const compilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  esModuleInterop: false,
  sourceMap: false,
  inlineSourceMap: false,
  inlineSources: false,
  removeComments: false,
};

function transpile(fileName, source) {
  const result = ts.transpileModule(source, {
    compilerOptions,
    fileName,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    const host = {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    };
    throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, host));
  }
  return result.outputText;
}

const refreshSource = await readFile("refresh.ts", "utf8");
const mainSource = await readFile("main.ts", "utf8");
const refreshJs = transpile("refresh.ts", refreshSource);
let mainJs = transpile("main.ts", mainSource);

const localImportPatterns = [
  /const refresh_1 = require\("\.\/refresh"\);/,
  /var refresh_1 = require\("\.\/refresh"\);/,
];
let replaced = false;
for (const pattern of localImportPatterns) {
  if (pattern.test(mainJs)) {
    mainJs = mainJs.replace(pattern, "const refresh_1 = __refreshModule;");
    replaced = true;
    break;
  }
}
if (!replaced) {
  throw new Error("Could not locate compiled ./refresh import in main.ts output.");
}

const banner = "// GENERATED FILE - built from main.ts and refresh.ts by build.mjs. Do not edit directly.\n";
const bundled = `${banner}const __refreshModule = {};\n(function(exports) {\n${refreshJs}\n})(__refreshModule);\n${mainJs}`;
await writeFile("main.js", bundled, "utf8");
console.log(`Built main.js (${Buffer.byteLength(bundled)} bytes)`);
