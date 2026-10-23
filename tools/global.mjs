import path from "node:path";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const localModules = path.join(here, "..", "node_modules");
const globalModules = path.join(process.env.APPDATA || "", "npm", "node_modules");
const paths = [process.env.NODE_PATH, localModules, globalModules].filter(Boolean);

process.env.NODE_PATH = [...new Set(paths)].join(path.delimiter);
Module._initPaths();

const require = createRequire(import.meta.url);

export async function loadPlaywright() {
  return require("playwright");
}

export { localModules, globalModules };
