import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const projectRequire = createRequire(path.join(projectRoot, "package.json"));

/** Muat modul aplikasi dengan pengganti layanan eksternal yang eksplisit. */
export function createTsLoader(replacements = {}) {
  const cache = new Map();
  function load(filename) {
    const absolute = path.isAbsolute(filename) ? filename : path.join(projectRoot, filename);
    const file = /\.tsx?$/.test(absolute) ? absolute : fs.existsSync(`${absolute}.ts`) ? `${absolute}.ts` : `${absolute}.tsx`;
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (specifier) => {
      if (Object.hasOwn(replacements, specifier)) return replacements[specifier];
      if (specifier === "server-only") return {};
      if (specifier.startsWith("@/")) return load(path.join(projectRoot, "src", specifier.slice(2)));
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(file), specifier));
      return projectRequire(specifier);
    };
    vm.runInThisContext(`(function(require, module, exports) {${compiled}\n})`, { filename: file })(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
