import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function isMainModule(moduleUrl: string): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined
    && pathToFileURL(path.resolve(entryPoint)).href === moduleUrl;
}
