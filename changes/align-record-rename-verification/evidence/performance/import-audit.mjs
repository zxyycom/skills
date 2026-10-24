// Import-only observation: real distribution entries are loaded, CLI commands do not run.
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks, stripTypeScriptTypes, createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [source,dependencies,output]=process.argv.slice(2);
const allowed=(p)=>p===source||p.startsWith(source+path.sep)||p===dependencies||p.startsWith(dependencies+path.sep);
const observed=[];
registerHooks({resolve(specifier,context,next){const r=next(specifier,context);if(r.url.startsWith('file:')){const p=fs.realpathSync(fileURLToPath(r.url));if(!allowed(p))throw new Error('scope escape '+p);observed.push({specifier,parent:context.parentURL??null,resolved:p});}return r;}});
for(const entry of ['skills/decision-records/scripts/decision-records.ts','skills/investigation-report/scripts/check-investigations.ts'])await import(pathToFileURL(path.join(source,entry)).href);
const files=[];const dynamic=[];const urls=[];let runtimeImports=0;
const walk=(dir)=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile()&&p.endsWith('.ts')&&!p.endsWith('.d.mts'))files.push(p);}};
for(const skill of ['decision-records','investigation-report'])walk(path.join(source,'skills',skill,'scripts'));
for(const p of files){
 const code=stripTypeScriptTypes(fs.readFileSync(p,'utf8'));
 const imports=[];
 for(const re of [/\b(?:import|export)\s+(?:(?!;)[\s\S])*?\s+from\s+["']([^"']+)["']/g,/\bimport\s*["']([^"']+)["']/g])for(const m of code.matchAll(re))imports.push(m[1]);
 const calls=[...code.matchAll(/\bimport\s*\(/g)];const literal=[...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)];
 if(calls.length!==literal.length)throw new Error('unresolved dynamic import '+p);
 for(const m of literal){imports.push(m[1]);dynamic.push({file:path.relative(source,p),specifier:m[1]});}
 for(const specifier of new Set(imports)){
  runtimeImports++;
  if(specifier.startsWith('node:'))continue;
  const target=specifier.startsWith('.')?path.resolve(path.dirname(p),specifier):createRequire(pathToFileURL(p)).resolve(specifier);
  if(!fs.existsSync(target))throw new Error('missing import '+p+' '+specifier);
  const real=fs.realpathSync(target);if(!allowed(real))throw new Error('static scope escape '+real);
 }
 for(const m of code.matchAll(/new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)){
  const target=path.resolve(path.dirname(p),m[1]);if(!fs.existsSync(target)||!allowed(fs.realpathSync(target)))throw new Error('URL closure '+p+' '+m[1]);urls.push({file:path.relative(source,p),specifier:m[1],resolved:path.relative(source,target)});
 }
}
fs.writeFileSync(output,JSON.stringify({entryImportOnly:true,cliCommandsExecuted:0,observedFileModules:[...new Set(observed.map(x=>x.resolved))].sort(),observedResolutions:observed,allStaticRuntimeTypeStrippedFiles:files.length,runtimeImportsChecked:runtimeImports,dynamicLiteralImports:dynamic,allDynamicImportsLiteral:true,urlsIncludingWorkers:urls,noResolvedScopeEscape:true,allowedBoundaries:[source,dependencies]},null,2)+'\n');
