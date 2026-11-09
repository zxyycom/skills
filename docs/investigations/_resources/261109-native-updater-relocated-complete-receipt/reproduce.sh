#!/usr/bin/env bash
# 形成时复现：在仓库根运行；断言 04805ac08f89f3cab20dfa0b2dc893c5c73811ce 的缺陷，不是修复后验收。
# 所有 release 响应均为进程内 fixture，仅操作并清理本次 mkdtemp 目录。
set -euo pipefail
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { activateNativeBundle } from './tools/skill-updater/src/native/native-transaction.ts';
import { verifyInstalledNativeEvidence, prepareBundleWithEvidence } from './tools/skill-updater/src/native/installed-evidence.ts';
import { planNativeHandoff } from './tools/skill-updater/src/native/native-plan.ts';
import { runNativeUpdaterCli } from './tools/skill-updater/src/native/cli.ts';
const target = 'x86_64-unknown-linux-gnu';
const roles = ['decision-records', 'investigation-report'];
const hash = 'a'.repeat(64);
function fixture(role, version) {
  const descriptor = {schemaVersion:1,role,runtimeVersion:'0.1.0',sourceHash:hash,targets:[target,'x86_64-pc-windows-msvc']};
  const schema = role === 'decision-records' ? 'decision-index.schema.json' : 'investigation-index.schema.json';
  const packageZip = zipSync({
    [role+'/SKILL.md']:strToU8('---\nname: '+role+'\nmetadata:\n  version: "'+version+'"\n---\n'),
    [role+'/native-runtime.json']:strToU8(JSON.stringify(descriptor)),
    [role+'/references/'+schema]:strToU8('{}'),
    [role+'/scripts/update-skill.ts']:strToU8('fixture')
  });
  const runtimeZip = zipSync({[role]:strToU8('binary fixture')});
  const asset = (name, data) => ({name,byteLength:data.length,sha256:createHash('sha256').update(data).digest('hex')});
  const entry = name => ({version,native:{schemaVersion:1,runtimeVersion:'0.1.0',sourceHash:hash,
    package:asset(name+'-native.zip',packageZip),
    targets:{[target]:asset(name+'-0.1.0-'+target+'.zip',runtimeZip),'x86_64-pc-windows-msvc':asset(name+'-0.1.0-x86_64-pc-windows-msvc.zip',runtimeZip)},
    bootstrap:asset('record-native-installer.zip',runtimeZip)}});
  const manifestBytes = Buffer.from(JSON.stringify({schemaVersion:1,skills:Object.fromEntries(roles.map(name => [name, entry(name)]))}));
  return {role,target,manifestBytes,packageZip,runtimeZip};
}
const scratch = await fs.mkdtemp(path.join(os.tmpdir(),'skill-relocation-investigation-'));
const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;
const results = [];
try {
  process.env.GITHUB_TOKEN = 'fixture-token';
  for (const role of roles) {
    const original = path.join(scratch,role,'original',role);
    const moved = path.join(scratch,role,'project','.codex','skills',role);
    await fs.mkdir(path.dirname(original),{recursive:true});
    await fs.mkdir(path.dirname(moved),{recursive:true});
    const installed = fixture(role,200);
    const next = fixture(role,201);
    await activateNativeBundle({...installed,destination:original,confirm:async()=>true,validatePrepared:async()=>{}});
    const receiptBytes = await fs.readFile(path.join(original,'.record-native-receipt.json'));
    const receipt = JSON.parse(receiptBytes);
    assert.equal(receipt.state,'complete');
    await assert.rejects(fs.lstat(receipt.backup),{code:'ENOENT'});
    const sameLocation = await planNativeHandoff({target:original,role,platform:target,files:prepareBundleWithEvidence(next)});
    assert.ok(sameLocation.replace.includes('SKILL.md'));
    await fs.rename(original,moved);
    const verified = await verifyInstalledNativeEvidence(moved,role,target);
    assert.ok(verified.length);
    const payloads = [next.manifestBytes,next.packageZip,next.runtimeZip];
    const assets = ['skill-release-manifest.json',role+'-native.zip',role+'-0.1.0-'+target+'.zip'].map((name,index)=>({name,url:'https://api.github.com/repos/fixture/skills/releases/assets/'+(index+1)}));
    globalThis.fetch = async request => {
      const url = String(request);
      if (url.endsWith('/releases/latest')) return Response.json({assets,tag_name:'fixture',html_url:'https://github.com/fixture/skills/releases/tag/fixture'});
      const index = assets.findIndex(asset=>asset.url===url);
      assert.ok(index>=0,'unexpected network request: '+url);
      return new Response(payloads[index]);
    };
    const config={repo:'fixture/skills',skillName:role,releaseAssetName:role+'-native.zip',releaseManifestAssetName:'skill-release-manifest.json',sourcePath:'skills/'+role};
    let checkError;
    try { await runNativeUpdaterCli(config,role,import.meta.url,['--check','--target-dir',moved]); }
    catch (error) { checkError=error.message; }
    assert.equal(checkError,'invalid native recovery directory');
    payloads[0] = installed.manifestBytes;
    payloads[1] = installed.packageZip;
    payloads[2] = installed.runtimeZip;
    const sameVersionCheck = await runNativeUpdaterCli(config,role,import.meta.url,['--check','--target-dir',moved]);
    assert.equal(sameVersionCheck,0);
    await assert.rejects(
      () => activateNativeBundle({...next,destination:moved,confirm:async()=>true,validatePrepared:async()=>{}}),
      /invalid native recovery directory/
    );
    assert.deepEqual(await fs.readFile(path.join(moved,'.record-native-receipt.json')),receiptBytes);
    await fs.writeFile(path.join(moved,'.record-native-receipt.json'),JSON.stringify({...receipt,backup:path.join(path.dirname(moved),'.'+role+'.native-finished')}));
    const rebound=await planNativeHandoff({target:moved,role,platform:target,files:prepareBundleWithEvidence(next)});
    assert.ok(rebound.replace.includes('SKILL.md'));
    results.push({role,receiptState:receipt.state,oldRecoveryAbsent:true,sameLocationPlan:'success',relocatedEvidence:'verified',relocatedCheck:checkError,sameVersionCheck:'current',activationAttempt:'invalid native recovery directory',checkKeptReceipt:true,onlyBackupReboundPlan:'success'});
  }
  console.log(JSON.stringify({offline:true,results},null,2));
} finally {
  globalThis.fetch=originalFetch;
  if(originalToken===undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN=originalToken;
  await fs.rm(scratch,{recursive:true,force:true});
}
JS
