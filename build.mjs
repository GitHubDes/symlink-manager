import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
import { minify } from "terser";

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
// Preserve CommonJS exports and Obsidian API property names. Terser's unsafe
// compression options remain disabled; only local identifiers are mangled.
const result = await minify(bundled, {
  ecma: 2022,
  module: false,
  toplevel: false,
  compress: { unsafe: false },
  mangle: { properties: false },
  sourceMap: false,
  format: { preamble: banner.trimEnd() },
});
if (!result.code) throw new Error("Minification produced no JavaScript.");
const output = `${result.code}\n`;
await writeFile("main.js", output, "utf8");
console.log(`Built minified main.js (${Buffer.byteLength(output)} bytes)`);
