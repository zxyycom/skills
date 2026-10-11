import fs from 'node:fs';
import path from 'node:path';
import { SourceMap } from 'node:module';
const [cliFile, profileDirectory, observations, output] = process.argv.slice(2);
const sourceMap=new SourceMap(JSON.parse(fs.readFileSync(cliFile+'.map','utf8')));
const data=JSON.parse(fs.readFileSync(observations,'utf8'));
const profiles=fs.readdirSync(profileDirectory).filter(x=>x.endsWith('.cpuprofile')).sort();
for (let i=0;i<profiles.length;i++){
 const profile=JSON.parse(fs.readFileSync(path.join(profileDirectory,profiles[i]),'utf8'));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
 const parents=new Map(profile.nodes.flatMap(n=>(n.children??[]).map(id=>[id,n.id])));
 const owner=new Map(profile.nodes.map(n=>{let module=n.callFrame.url;if(module.endsWith(path.basename(cliFile))){const entry=sourceMap.findEntry(n.callFrame.lineNumber,n.callFrame.columnNumber);module=entry.originalSource??module;}return [n.id,module.replace(/^.*(?=tools\/|node_modules\/)/,'')];}));
 const self={},inclusive={};
 for(let j=0;j<(profile.samples??[]).length;j++){
  const id=profile.samples[j], delta=profile.timeDeltas[j]; const source=owner.get(id);self[source]=(self[source]??0)+delta;
  const seen=new Set();let ancestor=id;while(nodes.has(ancestor)){const file=owner.get(ancestor);if(!seen.has(file)){inclusive[file]=(inclusive[file]??0)+delta;seen.add(file);}ancestor=parents.get(ancestor);}
 }
 data.samples[i].cpuProfile={method:'Native V8 CPU sampling (inclusive time is not additive; idle sampling is not CPU)',sampledMicros:profile.timeDeltas.reduce((a,b)=>a+b,0),selfMicros:Object.fromEntries(Object.entries(self).filter(([key])=>key.startsWith('tools/'))),inclusiveMicros:Object.fromEntries(Object.entries(inclusive).filter(([key])=>key.startsWith('tools/')))};
}
fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
