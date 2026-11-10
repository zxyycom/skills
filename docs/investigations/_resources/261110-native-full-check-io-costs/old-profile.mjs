// Phase-local directory enumeration counts; not a production optimization.
import fs from 'node:fs';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
const root=path.resolve(process.argv[process.argv.indexOf('--root')+1]);
const counts={};
const original=fs.promises.readdir;
fs.promises.readdir=async function(directory,...args) {
 const result=await original.call(this,directory,...args);
 const key=path.relative(root,String(directory));
 const row=counts[key]??={calls:0,entries:0};row.calls++;row.entries+=result.length;
 return result;
};
syncBuiltinESMExports();
process.on('exit',()=>process.stderr.write(`OLD_DIRECTORY_PROBE ${JSON.stringify(counts)}\n`));
