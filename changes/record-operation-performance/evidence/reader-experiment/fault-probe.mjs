import fs from 'node:fs';
import path from 'node:path';
import { execute } from './reader.mjs';
const [model,contract,kind]=process.argv.slice(2);
const dir=`/tmp/record-reader-experiment-1adb9846/faults/${model}-${contract}-${kind}`;
fs.mkdirSync(dir,{recursive:true});const root=path.join(dir,'root');fs.mkdirSync(root,{recursive:true});
const good='---\nid: probe\n---\n安全 bytes\n';let rel='probe.md',readingRoot=root,driftTarget;
fs.writeFileSync(path.join(root,rel),good);
switch(kind){
 case 'leaf-symlink':fs.writeFileSync(path.join(dir,'outside.md'),good);fs.unlinkSync(path.join(root,rel));fs.symlinkSync('../outside.md',path.join(root,rel));break;
 case 'parent-symlink':fs.mkdirSync(path.join(dir,'outside'));fs.writeFileSync(path.join(dir,'outside/probe.md'),good);fs.symlinkSync('../outside',path.join(root,'link'));rel='link/probe.md';break;
 case 'root-alias':fs.symlinkSync('root',path.join(dir,'alias'));readingRoot=path.join(dir,'alias');break;
 case 'invalid-utf8':fs.writeFileSync(path.join(root,rel),Buffer.from([0xff,0xfe]));break;
 case 'escape':rel='../outside.md';fs.writeFileSync(path.join(dir,'outside.md'),good);break;
 case 'directory':fs.mkdirSync(path.join(root,'directory'));rel='directory';break;
 case 'missing':rel='absent.md';break;
 case 'revision-drift':driftTarget=path.join(root,rel);break;
 default:throw new Error(kind);
}
let rejected=false,error;
try{await execute({model,contract,paths:[rel],root:readingRoot,concurrency:model==='B4'?4:1,driftTarget});}catch(e){rejected=true;error=String(e);}
console.log(JSON.stringify({model,contract,kind,rejected,error}));if(!rejected)process.exitCode=1;
