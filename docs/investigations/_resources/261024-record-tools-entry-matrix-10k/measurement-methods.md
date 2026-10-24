# 本轮测量与证据整理方法

本文保存形成时方法的阅读副本，用于按问题审查计量、计数和操作效果。先读[计量协议](protocol.md)，再从下表选择代码；这些代码依赖本轮输入与运行布局，随附材料未构成完整重放包。

相同字节的方法只保留一次，共 25 个代码块、29 个逻辑来源。路径使用统一展示标记；每块列出来源、输入字节数与 SHA-256，原始身份另见来源记录。导航与说明属于阅读层，代码块保持形成时内容。

## 阅读导航

| 复核问题 | 方法入口 |
| --- | --- |
| wall、CPU、RSS 与进程退出如何采集 | [共同采集器](#decisionmethodscollectorpy) |
| worker、文件 API、Git payload 如何计数及去重 | [共同 preload](#decisionmethodscommon-preloadmjs)、[计数汇总](#decisionmethodscommon-summarizepy)、[probe 接口](#decisionmethodsprobe-interfacemd)；IR [领域插桩](#investigationmethodsinstrumentpy) |
| 固定输入与场景初态如何准备 | DR [场景定义](#decisionmethodsdesignpy)、[输入准备](#decisionmethodspreparepy)；IR [输入模型](#investigationmethodsfixturepy)、[输入准备](#investigationmethodspreparepy) |
| 如何验证操作效果与未选保护 | DR [独立判据](#decisionmethodsoraclepy)、[状态归档](#decisionmethodsoutcomespy)；IR [独立判据](#investigationmethodsoraclepy)、[后验分派](#investigationmethodsposteriorpy)及其后的 mutation、query、stage、state 专项 |
| 如何执行样本并比较正常／probe | 运行器：[DR](#decisionmethodsrunpy)、[IR](#investigationmethodsrunpy)；IR [基础 smoke](#investigationmethodssmokepy)、[修改类 smoke](#investigationmethodssmoke_mutationpy) |
| 如何形成统计与保真展示 | 统计：[DR](#decisionmethodssummarize-resultspy)、[IR](#investigationmethodssummarize_resultspy)；[DR 导出](#decisionmethodsexportpy)、[IR 导出阅读副本](#decisionmethodsir-export-format-reading-copypy) |

## `decision/methods/collector.py`

逻辑来源：`decision/methods/collector.py`、`investigation/methods/collector.py`。

展示输入：7779 字节，SHA-256 `7aa0d83598b9bb55007a94e621b2b0623b5f008f6f25f66a0f1955e81d8f28a7`。

`````python
"""Measure one isolated CLI process; fixture setup and posterior are external."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Measurement:
    argv: tuple[str, ...]
    cwd: Path
    output_prefix: Path
    timeout_seconds: float
    domain: str
    scenario: str
    iteration: int
    mode: str
    environment: dict[str, str]


def owned_path(value: object, label: str) -> Path:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be an absolute owned path")
    path = Path(value)
    if not path.is_absolute() or not path.resolve().is_relative_to(ROOT):
        raise ValueError(f"{label} escapes the benchmark root")
    return path


def required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} must be nonempty text")
    return value


def parse_measurement(value: object) -> Measurement:
    if not isinstance(value, dict):
        raise ValueError("measurement specification must be an object")
    argv = value.get("argv")
    if not isinstance(argv, list) or not argv or any(
        not isinstance(item, str) for item in argv
    ):
        raise ValueError("argv must be a nonempty string array")
    timeout = value.get("timeoutSeconds", 600)
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)):
        raise ValueError("timeoutSeconds must be numeric")
    if not 0 < timeout <= 600:
        raise ValueError("timeoutSeconds must be within (0, 600]")
    iteration = value.get("iteration")
    if isinstance(iteration, bool) or not isinstance(iteration, int) or iteration < 0:
        raise ValueError("iteration must be a nonnegative integer")
    mode = value.get("mode")
    if mode not in {"normal", "instrumented", "smoke", "collector-selfcheck"}:
        raise ValueError("invalid measurement mode")
    environment = value.get("environment", {})
    if not isinstance(environment, dict) or any(
        not isinstance(key, str)
        or not key.startswith("RECORD_BENCH_")
        or not isinstance(item, str)
        for key, item in environment.items()
    ):
        raise ValueError("environment permits only RECORD_BENCH_* string values")
    cwd = owned_path(value.get("cwd"), "cwd")
    if not cwd.is_dir():
        raise ValueError("cwd does not exist")
    return Measurement(
        tuple(argv), cwd, owned_path(value.get("outputPrefix"), "outputPrefix"),
        float(timeout), required_text(value.get("domain"), "domain"),
        required_text(value.get("scenario"), "scenario"), iteration, mode,
        dict(environment),
    )


def subprocess_environment(extra: dict[str, str]) -> dict[str, str]:
    environment = dict(os.environ)
    for key in list(environment):
        if key.startswith("GIT_") or key.startswith("RECORD_BENCH_"):
            del environment[key]
    for key in ("NODE_PATH", "NODE_V8_COVERAGE", "NODE_COMPILE_CACHE"):
        environment.pop(key, None)
    environment.update({
        "NODE_OPTIONS": "", "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": os.devnull, "TZ": "UTC", "LC_ALL": "C.UTF-8",
    })
    environment.update(extra)
    return environment


def terminate_at_deadline(
    pid: int, timeout: float, finished: threading.Event, timed_out: threading.Event
) -> None:
    if finished.wait(timeout):
        return
    timed_out.set()
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def output_identity(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    return {"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def wait_for_process(
    specification: Measurement, stdout: object, stderr: object
) -> dict[str, object]:
    finished = threading.Event()
    timed_out = threading.Event()
    started = time.perf_counter()
    try:
        process = subprocess.Popen(
            specification.argv, cwd=specification.cwd, stdout=stdout, stderr=stderr,
            env=subprocess_environment(specification.environment), start_new_session=True,
        )
    except OSError as error:
        return {
            "outcome": "spawn-error", "spawnError": {"errno": error.errno, "message": str(error)},
            "wallSeconds": time.perf_counter() - started, "timedOut": False,
            "exitCode": None, "userSeconds": None, "systemSeconds": None,
            "cpuSeconds": None, "maxRssKiB": None,
        }
    deadline = threading.Thread(
        target=terminate_at_deadline,
        args=(process.pid, specification.timeout_seconds, finished, timed_out),
        daemon=True,
    )
    deadline.start()
    try:
        _, status, usage = os.wait4(process.pid, 0)
        elapsed = time.perf_counter() - started
        process.returncode = os.waitstatus_to_exitcode(status)
    except BaseException:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        _, status, _ = os.wait4(process.pid, 0)
        process.returncode = os.waitstatus_to_exitcode(status)
        raise
    finally:
        finished.set()
        deadline.join()
    return {
        "outcome": "timeout" if timed_out.is_set() else "exited",
        "timedOut": timed_out.is_set(), "exitCode": process.returncode,
        "wallSeconds": elapsed, "userSeconds": usage.ru_utime,
        "systemSeconds": usage.ru_stime,
        "cpuSeconds": usage.ru_utime + usage.ru_stime,
        "maxRssKiB": usage.ru_maxrss, "minorFaults": usage.ru_minflt,
        "majorFaults": usage.ru_majflt, "voluntaryContextSwitches": usage.ru_nvcsw,
        "involuntaryContextSwitches": usage.ru_nivcsw,
    }


def run_measurement(specification: Measurement) -> dict[str, object]:
    prefix = specification.output_prefix
    prefix.parent.mkdir(parents=True, exist_ok=True)
    stdout_path = Path(str(prefix) + ".stdout")
    stderr_path = Path(str(prefix) + ".stderr")
    metrics_path = Path(str(prefix) + ".metrics.json")
    for path in (stdout_path, stderr_path, metrics_path):
        if path.exists():
            raise FileExistsError(f"refusing to replace a prior observation: {path}")
    with stdout_path.open("xb") as stdout, stderr_path.open("xb") as stderr:
        started_at = datetime.now(timezone.utc).isoformat()
        process_result = wait_for_process(specification, stdout, stderr)
    result = {
        "schemaVersion": 1, "domain": specification.domain,
        "scenario": specification.scenario, "iteration": specification.iteration,
        "mode": specification.mode, "argv": list(specification.argv),
        "cwd": str(specification.cwd), "startedAt": started_at,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "timeoutSeconds": specification.timeout_seconds,
        **process_result,
        "stdout": output_identity(stdout_path), "stderr": output_identity(stderr_path),
    }
    with metrics_path.open("x") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write("\n")
    return result


def main() -> None:
    if sys.platform != "linux":
        raise RuntimeError("this collector's RSS units are defined only on Linux")
    if len(sys.argv) != 2:
        raise ValueError("usage: measure.py <specification.json>")
    specification_path = owned_path(sys.argv[1], "specification")
    result = run_measurement(parse_measurement(json.loads(specification_path.read_text())))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
`````

## `decision/methods/common-preload.mjs`

逻辑来源：`decision/methods/common-preload.mjs`、`investigation/methods/common-preload.mjs`。

展示输入：15044 字节，SHA-256 `8bcc71df775e305a5ad3bbd7be485cb8d81b31fafb8429cfa5fe04f9774789c1`。

`````javascript
/**
 * One-run workload observer. Only probe invocations import this module.
 * @typedef {{file:string,sha256:string,needle:string,insert:string}} SourceHook
 * @typedef {{outputDir:string,collectionRoot:string,indexFile:string,candidatePaths?:string[],resourceRoots?:string[],gitObjectRoles?:Record<string,string[]>,hooks?:SourceHook[]}} ProbeConfig
 * @typedef {{path:string,category:string,direction:'read'|'write',method:string,calls:number,bytes:number}} IoObservation
 * Config is a JSON boundary validated below. Operation state belongs to this thread;
 * JSONL append is the authoritative cross-thread handoff, not a shared mutable map.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import cp from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { threadId, isMainThread } from 'node:worker_threads';
import { AsyncLocalStorage } from 'node:async_hooks';

const rawRead = fs.readFileSync.bind(fs);
const rawWrite = fs.writeFileSync.bind(fs);
const rawAppend = fs.appendFileSync.bind(fs);
const configPath = process.env.RECORD_BENCH_PROBE_CONFIG;
if (!configPath) throw new Error('RECORD_BENCH_PROBE_CONFIG is required for probe');
const config = JSON.parse(rawRead(configPath, 'utf8'));
if (!config || typeof config !== 'object' || typeof config.outputDir !== 'string' || typeof config.collectionRoot !== 'string' || typeof config.indexFile !== 'string') {
  throw new Error('Invalid probe config: outputDir/collectionRoot/indexFile required');
}
for (const key of ['candidatePaths', 'resourceRoots', 'hooks']) {
  if (config[key] !== undefined && !Array.isArray(config[key])) throw new Error('Invalid array '+key);
}
for(const key of ['candidatePaths','resourceRoots']) {
  if((config[key]??[]).some(p=>typeof p!=='string'||!path.isAbsolute(p)))throw new Error('Invalid absolute paths '+key);
}
if(config.gitObjectRoles!==undefined && (!config.gitObjectRoles||typeof config.gitObjectRoles!=='object'||Object.values(config.gitObjectRoles).some(oids=>!Array.isArray(oids)||oids.some(oid=>typeof oid!=='string'||!/^[0-9a-f]{40,64}$/u.test(oid)))))throw new Error('Invalid Git object role map');
const collectionRoot = path.resolve(config.collectionRoot);
const indexFile = path.resolve(config.indexFile);
const observedRoles = new Map();
const candidates = new Set((config.candidatePaths ?? []).map(p => path.resolve(p)));
const resources = (config.resourceRoots ?? []).map(p => path.resolve(p));
const state = {schemaVersion:1, pid:process.pid,threadId,isMainThread,io:[],git:[],counts:{},transforms:[],unknown:[],boundaries:[
  'Logical Node FS API completed bytes; nested readFile/read and writeFile/write deduplicated.',
  'Successful readFile string byte length uses returned text encoding; all benchmark source reads use Buffer or UTF-8.',
  'Failed high-level IO can transfer partial bytes without reporting them; marked unknown.',
  'Git subprocess internal filesystem IO is not observed. Git stdout protocol bytes are observed.',
  'Kernel cache/storage physical reads, mmap, native-addon direct IO, and Node module-loader internals are outside this observer.'
]};
const eventPath=path.join(config.outputDir,`probe-${process.pid}-${threadId}.events.jsonl`);
let observerIO=false;
function event(type,value) { observerIO=true; try { rawAppend(eventPath,JSON.stringify({type,value})+'\n'); } finally { observerIO=false; } }
event('start',{schemaVersion:1,pid:process.pid,threadId,isMainThread});
const fds = new Map();
const io = new Map();
let syncDepth = 0;
let gitSequence = 0;
function textPath(value) {
  if (typeof value === 'number') return fds.get(value) ?? `unknown-fd:${value}`;
  if (value instanceof URL) return fileURLToPath(value);
  if (typeof value === 'string' || Buffer.isBuffer(value)) return path.resolve(String(value));
  return 'unknown-path';
}
function category(p) {
  if (p === indexFile) return 'index';
  if (observedRoles.has(p)) return observedRoles.get(p);
  if (candidates.has(p)) return 'candidate';
  if (resources.some(r => p === r || p.startsWith(r+path.sep))) return 'resource';
  if (p.startsWith(collectionRoot+path.sep) && p.endsWith('.md')) return 'formal';
  if (p === collectionRoot || p.startsWith(collectionRoot+path.sep)) return 'collection-other';
  if (p.startsWith('unknown-')) return 'unknown';
  return 'other';
}
function length(data, encoding='utf8') {
  if (typeof data === 'string') return Buffer.byteLength(data, typeof encoding === 'string' ? encoding : 'utf8');
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return null;
}
function record(p, direction, method, bytes, content) {
  if(observerIO)return;
  if(p.startsWith(collectionRoot+path.sep) && p.endsWith('.md') && (typeof content==='string'||Buffer.isBuffer(content))) {
    const header=(typeof content==='string'?content:content.toString('utf8',0,Math.min(content.length,4096)));
    if(/^\ufeff?---\r?\n/u.test(header)) {
      const status=/^status:\s*["']?(candidate|active|archived)["']?\s*$/mu.exec(header);
      if(status)observedRoles.set(p,status[1]==='candidate'?'candidate':'formal');
    }
  }
  if (!Number.isSafeInteger(bytes) || bytes < 0) { state.unknown.push({p,direction,method,reason:'unreported-byte-count'}); return; }
  const key=JSON.stringify([p,direction,method]);
  const prior=io.get(key) ?? {path:p,category:category(p),direction,method,calls:0,bytes:0};
  prior.calls++; prior.bytes+=bytes; io.set(key,prior); event('io',{path:p,category:category(p),direction,method,calls:1,bytes});
}
function failed(p,direction,method,error) {
  if(observerIO)return;
  state.unknown.push({path:p,direction,method,reason:'failed-operation-partial-bytes-unknown',error:error instanceof Error ? error.message : String(error)});
}
globalThis.__recordProbeCount = (name,amount=1) => {
  if (typeof name !== 'string' || !Number.isFinite(amount)) throw new Error('Invalid probe count');
  state.counts[name] = (state.counts[name] ?? 0)+amount; event('count',{name,amount});
};

// Synchronous APIs: depth suppression prevents readFileSync(fd)->readSync double count.
const rawOpenSync=fs.openSync; const rawCloseSync=fs.closeSync;
fs.openSync=function(...args) { const fd=Reflect.apply(rawOpenSync,this,args); fds.set(fd,textPath(args[0])); return fd; };
fs.closeSync=function(fd) { try { return rawCloseSync(fd); } finally { fds.delete(fd); } };
for (const [name,direction] of [['readFileSync','read'],['writeFileSync','write'],['appendFileSync','write'],['readSync','read'],['writeSync','write']]) {
  const original=fs[name];
  fs[name]=function(...args) {
    const nested=syncDepth>0; const p=textPath(args[0]); syncDepth++;
    try {
      const result=Reflect.apply(original,this,args);
      if (!nested) {
        const bytes=name==='readFileSync' ? length(result,args[1]?.encoding ?? args[1]) : name==='readSync'||name==='writeSync' ? result : length(args[1],args[2]?.encoding ?? args[2]);
        record(p,direction,name,bytes,name==='readFileSync'?result:direction==='write'?args[1]:undefined);
      }
      return result;
    } catch(error) { if (!nested) failed(p,direction,name,error); throw error; }
    finally { syncDepth--; }
  };
}

// Promise path APIs are high-level boundaries and do not call the exported open wrapper.
for (const [name,direction] of [['readFile','read'],['writeFile','write'],['appendFile','write']]) {
  const original=fsp[name];
  fsp[name]=async function(...args) {
    const p=textPath(args[0]);
    try { const result=await Reflect.apply(original,this,args); record(p,direction,name,name==='readFile'?length(result,args[1]?.encoding ?? args[1]):length(args[1],args[2]?.encoding ?? args[2]),name==='readFile'?result:args[1]); return result; }
    catch(error) { failed(p,direction,name,error); throw error; }
  };
}
const handleContext=new AsyncLocalStorage();
const rawOpen=fsp.open;
fsp.open=async function(...args) {
  const p=textPath(args[0]); const handle=await Reflect.apply(rawOpen,this,args); fds.set(handle.fd,p);
  for (const [name,direction] of [['readFile','read'],['writeFile','write'],['appendFile','write'],['read','read'],['write','write'],['readv','read'],['writev','write']]) {
    const original=handle[name];
    handle[name]=async function(...values) {
      const ancestors=handleContext.getStore() ?? new Set();
      const nested=ancestors.has(handle);
      const context=new Set([...ancestors,handle]);
      try {
        const result=await handleContext.run(context,()=>Reflect.apply(original,this,values));
        if (!nested) {
          const bytes=['read','readv'].includes(name)?result.bytesRead:['write','writev'].includes(name)?result.bytesWritten:name==='readFile'?length(result,values[0]?.encoding ?? values[0]):length(values[0],values[1]?.encoding ?? values[1]);
          record(p,direction,'FileHandle.'+name,bytes,name==='readFile'?result:name==='read'?result.buffer:direction==='write'?values[0]:undefined);
        }
        return result;
      } catch(error) { if (!nested) failed(p,direction,'FileHandle.'+name,error); throw error; }
    };
  }
  const close=handle.close.bind(handle); const fd=handle.fd;
  handle.close=async function() { try { return await close(); } finally { fds.delete(fd); } };
  return handle;
};

// Per-call async context suppresses internal callback write/read without suppressing concurrent calls.
const callbackContext=new AsyncLocalStorage();
// Callback APIs used by consumers are observed without replacing their callback semantics.
const rawOpenCallback=fs.open;
fs.open=function(...args) {
  const callback=args.at(-1); const p=textPath(args[0]);
  if (typeof callback!=='function') return Reflect.apply(rawOpenCallback,this,args);
  args[args.length-1]=function(error,fd) { if (!error) fds.set(fd,p); return callback(error,fd); };
  return Reflect.apply(rawOpenCallback,this,args);
};
for (const [name,direction] of [['readFile','read'],['writeFile','write'],['appendFile','write'],['read','read'],['write','write']]) {
  const original=fs[name];
  fs[name]=function(...args) {
    const callback=args.at(-1); const p=textPath(args[0]);
    if (typeof callback!=='function' || callbackContext.getStore()===true) return Reflect.apply(original,this,args);
    args[args.length-1]=function(error,result,...rest) {
      if (error) failed(p,direction,name,error);
      else record(p,direction,name,name==='readFile'?length(result,args[1]?.encoding ?? args[1]):name==='read'||name==='write'?result:length(args[1],args[2]?.encoding ?? args[2]),name==='readFile'?result:direction==='write'?args[1]:undefined);
      return callbackContext.run(false,()=>callback(error,result,...rest));
    };
    return callbackContext.run(true,()=>Reflect.apply(original,this,args));
  };
}

function parseBatch(buffer) {
  const blobs=[]; let offset=0; let headerBytes=0; let payloadBytes=0;
  while(offset<buffer.length) {
    const end=buffer.indexOf(10,offset); if(end<0) throw new Error('truncated batch header');
    const header=buffer.subarray(offset,end).toString('ascii'); const match=/^([0-9a-f]+) blob (\d+)$/.exec(header);
    if(!match) throw new Error('unexpected batch header: '+header);
    const size=Number(match[2]); headerBytes+=end+1-offset; offset=end+1;
    if(!Number.isSafeInteger(size)||offset+size>=buffer.length||buffer[offset+size]!==10) throw new Error('truncated batch payload');
    const memberships=Object.entries(config.gitObjectRoles ?? {}).filter(([,oids])=>oids.includes(match[1])).map(([role])=>role);
    blobs.push({oid:match[1],bytes:size,roles:memberships.length?memberships:['unknown']}); payloadBytes+=size; offset+=size+1;
  }
  return {blobs,headerBytes,payloadBytes,trailerBytes:blobs.length};
}
function observeChild(child,command,args) {
  if (path.basename(String(command))!=='git') return child;
  const entry={sequence:gitSequence++,command:String(command),argv:args,stdoutBytes:0,stderrBytes:0,requests:[],batch:null,exitCode:null};
  state.git.push(entry); const stdout=[];
  if(child.stdout) child.stdout.on('data',chunk => { const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk); entry.stdoutBytes+=data.length; if(args.includes('cat-file')&&args.includes('--batch')) stdout.push(data); });
  if(child.stderr) child.stderr.on('data',chunk => {entry.stderrBytes+=Buffer.byteLength(chunk);});
  if(child.stdin) {
    const write=child.stdin.write.bind(child.stdin); const end=child.stdin.end.bind(child.stdin); let input='';
    child.stdin.write=function(...values) { if(typeof values[0]==='string'||Buffer.isBuffer(values[0])) input+=String(values[0]); return Reflect.apply(write,this,values); };
    child.stdin.end=function(...values) { if(typeof values[0]==='string'||Buffer.isBuffer(values[0])) input+=String(values[0]); entry.requests=input.split('\n').filter(Boolean); return Reflect.apply(end,this,values); };
  }
  child.once('close',code => { entry.exitCode=code; if(stdout.length) { try {entry.batch=parseBatch(Buffer.concat(stdout));} catch(error) {entry.batch={error:String(error),payloadBytes:null};state.unknown.push({reason:'git-batch-frame-failure',sequence:entry.sequence});} } event('git',entry); });
  return child;
}
for (const name of ['spawn','execFile']) {
  const original=cp[name];
  cp[name]=function(...args) { return observeChild(Reflect.apply(original,this,args),args[0],Array.isArray(args[1])?args[1]:[]); };
}
// Mutation of built-ins must precede loading production ESM named imports, also in workers.
syncBuiltinESMExports();

const specs=config.hooks ?? [];
for (const spec of specs) {
  if(!spec||typeof spec.file!=='string'||typeof spec.sha256!=='string'||typeof spec.needle!=='string'||typeof spec.insert!=='string') throw new Error('Invalid source hook spec');
}
if(specs.length) registerHooks({load(url,context,nextLoad) {
  const result=nextLoad(url,context); const file=url.startsWith('file:')?fileURLToPath(url):null;
  const matches=specs.filter(spec=>path.resolve(spec.file)===file);
  if(!matches.length) return result;
  let source=typeof result.source==='string'?result.source:Buffer.from(result.source).toString('utf8');
  const originalSha=createHash('sha256').update(source).digest('hex');
  for(const spec of matches) {
    if(spec.sha256!==originalSha) throw new Error('Probe source fingerprint mismatch: '+file);
    if(source.split(spec.needle).length!==2) throw new Error('Probe hook needle not unique: '+file);
    source=source.replace(spec.needle,spec.needle+spec.insert);
    state.transforms.push({file,originalSha,needle:spec.needle,insert:spec.insert});
  }
  state.transforms.push({file,transformedSha:createHash('sha256').update(source).digest('hex')});
  return {...result,source};
}});

process.on('exit',()=> {
  state.io=[...io.values()];
  event('end',{unknown:state.unknown,boundaries:state.boundaries,transforms:state.transforms});
  observerIO=true;
  rawWrite(path.join(config.outputDir,`probe-${process.pid}-${threadId}.json`),JSON.stringify(state,null,2)+'\n');
});
`````

## `decision/methods/common-summarize.py`

逻辑来源：`decision/methods/common-summarize.py`、`investigation/methods/common-summarize.py`。

展示输入：6618 字节，SHA-256 `dab74b2a4c8acd3014c71d75d2eaa3e4797f3eb085baf0ee00145ada02222fd9`。

`````python
"""Aggregate completed per-thread events; malformed or missing evidence fails closed."""
from __future__ import annotations

from collections import defaultdict
import json
import math
from pathlib import Path
import sys
from typing import Mapping

CATEGORIES = {'index', 'candidate', 'resource', 'formal', 'collection-other', 'other', 'unknown'}

def object_value(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ValueError(f'{label} must be an object')
    return value


def numeric(value: object, label: str, integer: bool = True) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f'{label} must be numeric')
    if not math.isfinite(value) or value < 0 or integer and not isinstance(value, int):
        raise ValueError(f'{label} must be a finite nonnegative '+('integer' if integer else 'number'))
    return value


def text_value(value: object, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f'{label} must be nonempty text')
    return value


def validate_start(value: Mapping[str, object]) -> None:
    if value.get('schemaVersion') != 1:
        raise ValueError('Unsupported counter event schema')
    numeric(value.get('pid'), 'pid')
    numeric(value.get('threadId'), 'threadId')
    if not isinstance(value.get('isMainThread'), bool):
        raise ValueError('isMainThread must be boolean')


def summarize(directory: Path) -> dict[str, object]:
    if not directory.is_dir():
        raise ValueError('Counter directory missing')
    streams = sorted(directory.glob('*.events.jsonl'))
    if not streams:
        raise ValueError('Counter event streams missing')
    categories: dict[tuple[str, str], dict[str, object]] = {}
    paths: dict[tuple[str, str], set[str]] = defaultdict(set)
    counts: dict[str, int | float] = defaultdict(int)
    threads: list[dict[str, object]] = []
    git: list[dict[str, object]] = []
    unknown: list[object] = []
    transforms: list[object] = []
    for source in streams:
        started: dict[str, object] | None = None
        ended = False
        for line_number, line in enumerate(source.read_text().splitlines(), 1):
            event = object_value(json.loads(line), f'{source}:{line_number}')
            kind = text_value(event.get('type'), 'event type')
            value = object_value(event.get('value'), 'event value')
            if kind == 'start':
                if started is not None:
                    raise ValueError('Duplicate thread start')
                validate_start(value)
                started = value
                continue
            if started is None or ended:
                raise ValueError('Event outside start/end lifecycle')
            if kind == 'end':
                for field in ('unknown', 'boundaries', 'transforms'):
                    if not isinstance(value.get(field), list):
                        raise ValueError(f'Invalid end {field}')
                ended = True
                unknown.extend(value['unknown'])
                transforms.extend(value['transforms'])
            elif kind == 'count':
                name = text_value(value.get('name'), 'counter name')
                amount = numeric(value.get('amount'), 'counter amount', integer=False)
                counts[name] += amount
            elif kind == 'git':
                if not isinstance(value.get('argv'), list) or not all(isinstance(arg, str) for arg in value['argv']):
                    raise ValueError('Invalid Git argv')
                numeric(value.get('stdoutBytes'), 'Git stdoutBytes')
                numeric(value.get('stderrBytes'), 'Git stderrBytes')
                batch = value.get('batch')
                if batch is not None:
                    batch = object_value(batch, 'Git batch')
                    if batch.get('payloadBytes') is None:
                        unknown.append({'reason': 'git-batch-frame-failure', 'sequence': value.get('sequence')})
                    else:
                        numeric(batch.get('payloadBytes'), 'Git payloadBytes')
                        numeric(batch.get('headerBytes'), 'Git headerBytes')
                        numeric(batch.get('trailerBytes'), 'Git trailerBytes')
                        if batch['payloadBytes'] + batch['headerBytes'] + batch['trailerBytes'] != value['stdoutBytes']:
                            raise ValueError('Git framing byte sum differs from stdout')
                git.append(value)
            elif kind == 'io':
                category = text_value(value.get('category'), 'IO category')
                direction = value.get('direction')
                if category not in CATEGORIES or direction not in ('read', 'write'):
                    raise ValueError('Unknown IO category/direction')
                locator = text_value(value.get('path'), 'IO path')
                text_value(value.get('method'), 'IO method')
                calls = numeric(value.get('calls'), 'IO calls')
                transferred = numeric(value.get('bytes'), 'IO bytes')
                key = (category, direction)
                item = categories.setdefault(key, {'category': category, 'direction': direction, 'calls': 0, 'bytes': 0})
                item['calls'] += calls
                item['bytes'] += transferred
                paths[key].add(locator)
            else:
                raise ValueError(f'Unknown counter event type {kind}')
        if started is None:
            raise ValueError('Missing thread start')
        threads.append({**started, 'completed': ended, 'events': str(source)})
        if not ended:
            unknown.append({'reason': 'thread-no-end-event', 'thread': started})
    rows = [{**item, 'uniqueFiles': len(paths[key]), 'paths': sorted(paths[key])} for key, item in categories.items()]
    batches = [entry['batch'] for entry in git if entry['batch'] is not None]
    payload = sum(batch['payloadBytes'] for batch in batches) if all(batch.get('payloadBytes') is not None for batch in batches) else None
    return {
        'schemaVersion': 1,
        'threads': threads,
        'io': rows,
        'counts': dict(counts),
        'git': git,
        'gitBatchCount': len(batches),
        'gitActualPayloadBytes': payload,
        'gitStdoutBytes': sum(entry['stdoutBytes'] for entry in git),
        'unknown': unknown,
        'transforms': transforms,
    }


if __name__ == '__main__':
    print(json.dumps(summarize(Path(sys.argv[1])), ensure_ascii=False, indent=2))
`````

## `decision/methods/design.py`

逻辑来源：`decision/methods/design.py`。

展示输入：8553 字节，SHA-256 `be6fc13338a75bc269d0a53c883b31c4d51b6e6f8364e8bb74ad12f4d65c9bae`。

`````python
"""Emit the reviewed Decision-only one-operation benchmark matrix; no CLI execution."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
rows: list[dict[str, object]] = []

def add(key: str, argv: list[str], setup: str, expected: str, code: int = 0) -> None:
    rows.append({'id': key, 'argv': argv, 'setup': setup, 'expected': expected, 'exit': code,
                 'formalCount': 0 if setup == 'first-publish' else 10000,
                 'normalRepetitions': 3, 'counterRepetitions': 1})

A='261001-record-09001'; B='261001-record-09002'; Z='261001-record-10000'
P='261001-record-08001'; C='261001-candidate-1'; D='261001-candidate-2'
add('list', ['list','--limit','10'], 'base', '10 active entries, total 1000; published-index source')
add('list-relations', ['list','--status','all','--related-to',A,'--direction','predecessors','--relation-type','修订','--detail'], 'base', 'exactly P and filter edge A→P; graph validates full index')
add('show', ['show',A], 'base', 'exact current A body and identity; no file/index changes')
add('show-current', ['show',A], 'body-edit', 'edited current body and stale revision warning; no changes')
add('metadata', ['search','固定','--in','metadata','--limit','10'], 'base', 'matched exact 1000, returned 10, results limited, no content reads')
add('metadata-relations', ['search','固定','--in','metadata','--status','all','--related-to',A,'--direction','predecessors'], 'base', 'exact single P with relation evidence')
add('content-small', ['search','采用:','--status','all','--related-to',A,'--direction','predecessors'], 'base', 'single current P, complete search and preview')
add('content-return-limit', ['search','固定'], 'base', 'returned 20, matched at least 21, incomplete results; warning')
add('content-budget-refuse', ['search','absent-needle','--related-to',A,'--direction','predecessors','--status','all'], 'oversize-P', 'nonzero maxFileBytes budget failure; exact unchanged files',1)
add('content-argument-refuse', ['search','固定','--limit','1'], 'base', 'metadata-only --limit rejected, zero writes',2)
add('trace', ['trace',A,'--depth','all','--max-records','20','--json'], 'base', '10 chain members,9 edges,complete')
add('trace-limited', ['trace',A,'--depth','1','--max-records','2','--json'], 'base', 'bounded slice/frontier, incomplete coverage, no writes')
add('candidates', ['candidates'], 'base', 'exact C,D candidates, body ready; no formal bodies needed')
add('show-candidate', ['show-candidate',C], 'base', 'exact C body and body-ready status')
add('new', ['new','candidate-new','--title','Benchmark new','--purpose','固定目的','--background','固定背景','--decision','固定选择','--tag','benchmark'], 'base', 'one new candidate, no formal/index change; scaffold readiness not confused with body readiness')
add('publish-independent', ['publish',C,'--alignment','unaligned'], 'base', 'C active; 10001 formal; original 10000 unchanged')
add('publish-predecessor', ['publish',C,'--alignment','unaligned'], 'candidate-predecessor', 'C active,A archived; 10001 formal; summary retained')
add('publish-preflight', ['publish',C,'--alignment','unaligned','--preflight'], 'candidate-predecessor', 'phase preflight, full review, zero persistent writes')
add('publish-first-no-index', ['publish',C,'--alignment','unaligned'], 'first-publish', '0→1 formal, legal new index; explicitly NOT a 10000-record sample')
add('evolve-candidate', ['evolve','--successor',f'unaligned={C}','--relation',f'修订={A}','--relation-summary',f'{A}=benchmark successor'], 'base', 'C established,A archived; review establish')
add('evolve-formal', ['evolve','--successor',f'aligned={B}','--relation',f'修订={A}'], 'base', 'B remains formal,A archived,relations replaced,alignment aligned; no discard')
add('evolve-formal-discard', ['evolve','--successor',f'aligned={B}','--relation',f'修订={A}','--discard',Z,'--delete-recorded'], 'base', 'A archived,B modified,Z deleted;9999 formal')
add('evolve-candidate-discard', ['evolve','--successor',f'unaligned={C}','--discard',Z,'--delete-recorded'], 'base', 'C established,Z deleted;10000 formal')
add('evolve-preflight', ['evolve','--successor',f'aligned={B}','--relation',f'修订={A}','--preflight'], 'base', 'preflight complete relation review, zero writes')
add('set-relations', ['set-relations','--source',A,'--clear-relations'], 'base', 'A relations empty,index updated;all lifecycle/body/other metadata unchanged')
add('set-relations-preflight', ['set-relations','--source',A,'--clear-relations','--preflight'], 'base', 'preflight review,zero persistent writes')
add('mark-aligned', ['mark-aligned',A], 'base', 'A alignment aligned; unchanged body,status,createdAt,relations')
add('archive', ['archive',A], 'base', 'A archived,location moved,index updated; history accepted from real HEAD')
add('reactivate', ['reactivate',Z,'--alignment','unaligned'], 'archived-Z', 'Z active,location root,createdAt/relations preserved')
add('reactivate-preflight', ['reactivate',Z,'--alignment','unaligned','--preflight'], 'archived-Z', 'preflight zero persistent writes')
add('check', ['check'], 'base', 'complete set healthy,10000 formal+2 ready candidates,zero writes')
for mode in ('selected','full'):
    select=['--select',A] if mode=='selected' else []
    for branch,setup,opts in [('current','base',[]),('changed','body-edit',[]),('preflight','body-edit',['--preflight'])]:
        add(f'sync-{mode}-{branch}', ['sync-index',*select,*opts], setup,
            'complete independent index/source projection; '+('zero writes' if branch!='changed' else 'only index changes;edited revision adopted'))
for kind,target in [('candidate',C),('formal',A)]:
    for branch in ('actual','noop','preflight'):
        dest=target if branch=='noop' else 'renamed-benchmark'
        flags=(['--rename-recorded-decision'] if branch=='actual' else [])+(['--preflight'] if branch=='preflight' else [])
        add(f'rename-{kind}-{branch}', ['rename',target,dest,*flags], 'base',
            'zero persistent writes' if branch!='actual' else ('target ID/path renamed; incoming targets rewritten; old ID absent; formal index updated' if kind=='formal' else 'candidate target ID/path renamed; candidate incoming targets rewritten; index byte-identical'))
add('rename-formal-history-refuse', ['rename',A,'renamed-benchmark'], 'base', 'recorded identity confirmation refusal;zero writes',1)
add('discard-candidate', ['discard',C,'--delete-recorded'], 'base', 'only C removed; index unchanged')
add('discard-formal', ['discard',Z,'--delete-recorded'], 'base', 'Z removed,index9999;no remaining references to Z')
add('discard-formal-history-refuse', ['discard',Z], 'base', 'recorded deletion confirmation refusal;zero writes',1)
add('archive-unrecorded-refuse', ['archive',A], 'A-unrecorded', 'unrecorded-history gate refusal,zero writes',1)
add('archive-unrecorded-keep', ['archive',A,'--keep-unrecorded-history'], 'A-unrecorded', 'A archived with explicit unrecorded-history preservation')
add('new-first-no-index', ['new','candidate-new','--title','Benchmark new','--purpose','固定目的','--background','固定背景','--decision','固定选择','--tag','benchmark'], 'first-publish', 'new candidate created via no-index identity discovery;0 formal;index absent')
add('candidates-first-no-index', ['candidates'], 'first-publish', '2 candidates via no-index discovery;0 formal;index absent')
for scope in ('index','domain','all'):
    for branch,setup in [('first','stage-A-edited'),('preserve-unselected','stage-B-pending-A-edited'),('reselect','stage-A-pending-A-reedited'),('unchanged','base')]:
        add(f'stage-{scope}-{branch}', ['stage',A,'--scope',scope], setup,
            f'HEAD/worktree unchanged by stage; pending {scope} exact selected projection;'+
            (' preserve B pending bytes/OID/mode' if branch=='preserve-unselected' else ' reselected A newest complete bytes' if branch=='reselect' else ' no pending change' if branch=='unchanged' else 'only scope paths change'))
for row in rows:
    if row['id'] in ('rename-candidate-noop', 'rename-formal-noop'):
        row['setup'] = 'canonical-name-paths'
(ROOT/'matrix.json').write_text(json.dumps({'version':1,'publicPrefix':['node','<snapshot>/skills/decision-records/scripts/decision-records.ts','--root','<sample-root>'],'scenarios':rows},ensure_ascii=False,indent=2)+'\n')
commands=sorted({str(r['argv'][0]) for r in rows})
assert len(commands)==18, commands
print(json.dumps({'scenarios':len(rows),'commands':commands},ensure_ascii=False))
`````

## `decision/methods/export.py`

逻辑来源：`decision/methods/export.py`。

展示输入：12977 字节，SHA-256 `cefe2698f349eb1d454bc9982e4aa393413c2de064afb482b0b816eba3d1633b`。

`````python
"""Adapt the audited IR concise export format for Decision evidence; no CLI execution."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys

OWNER = Path(__file__).resolve().parents[1]
BENCH_ROOT = OWNER.parent
DESTINATION = Path(__file__).resolve().parent/'bundle'
HELPER = BENCH_ROOT/'investigation/export/prepare_export.py'
spec = importlib.util.spec_from_file_location('ir_export_format', HELPER)
helper = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = helper
spec.loader.exec_module(helper)
ExportWriter = helper.ExportWriter
canonical = helper.canonical
digest = helper.digest
display = helper.display
read_object = helper.read_object


def state_hashes(value: dict[str, object]) -> dict[str, str]:
    return {'worktree': digest(canonical({'files': value['files'], 'modes': value['modes']})),
            'pending': digest(canonical(value['pending'])), 'complete': digest(canonical(value))}


def file_fact(locator: str, manifest: dict[str, object], source: Path) -> dict[str, object] | None:
    if locator not in manifest['files']:
        return None
    data = source.read_bytes()
    expected = manifest['files'][locator]
    if digest(data) != expected:
        raise AssertionError('Retained changed bytes differ from final/input manifest: '+str(source))
    return {'sha256': expected, 'bytes': len(data), 'mode': format(manifest['modes'][locator], '04o')}


def pending_fact(value: object) -> dict[str, object] | None:
    if value is None:
        return None
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError('Invalid pending identity')
    return {'mode': value[0], 'objectId': value[1]}


def delta(initial: dict[str, object], final: dict[str, object], setup: str, prefix: Path, proof: dict[str, object]) -> dict[str, object]:
    worktree_paths = sorted(locator for locator in set(initial['files']) | set(final['files']) if initial['files'].get(locator) != final['files'].get(locator) or initial['modes'].get(locator) != final['modes'].get(locator))
    expected_paths = sorted('docs/decisions/'+locator for locator in proof['worktreeChangedPaths'])
    if worktree_paths != expected_paths:
        raise AssertionError('Export worktree delta differs from audited exact scope')
    pending_paths = sorted(locator for locator in set(initial['pending']) | set(final['pending']) if initial['pending'].get(locator) != final['pending'].get(locator))
    if pending_paths != sorted(proof['pendingChangedPaths']):
        raise AssertionError('Export pending delta differs from audited exact scope')
    final_bytes = prefix.parent/(prefix.name+'.final-files')
    return {
        'worktreeDelta': [{'path': locator,
                           'before': file_fact(locator, initial, OWNER/'fixtures'/setup/locator),
                           'after': file_fact(locator, final, final_bytes/locator)} for locator in worktree_paths],
        'pendingDelta': [{'path': locator, 'before': pending_fact(initial['pending'].get(locator)),
                          'after': pending_fact(final['pending'].get(locator))} for locator in pending_paths],
    }


def export_samples(writer: ExportWriter) -> tuple[list[dict[str, object]], dict[str, dict[str, object]], list[dict[str, object]]]:
    matrix = read_object(OWNER/'matrix.json')
    rows = matrix['scenarios']
    if len(rows) != 63:
        raise ValueError('Expected approved 63 Decision scenarios')
    equivalent = read_object(OWNER/'equivalence.json')
    if not equivalent['passed'] or equivalent['count'] != 189:
        raise ValueError('Cross-sample equivalence unavailable')
    samples = []
    streams = {}
    inputs = []
    recorded = set()
    for row in rows:
        name = row['id']
        setup = row['setup']
        initial_file = OWNER/'inputs'/(setup+'-v3.json')
        initial = read_object(initial_file)
        initial_hashes = state_hashes(initial)
        if setup not in recorded:
            inputs.append({'setup': setup, 'formalCount': row['formalCount'], 'manifestBytes': initial_file.stat().st_size,
                           'manifestSha256': digest(initial_file.read_bytes()), 'completeCanonicalSha256': initial_hashes['complete'],
                           'worktreeSha256': initial_hashes['worktree'], 'pendingSha256': initial_hashes['pending'],
                           'worktreeFiles': len(initial['files']), 'pendingIdentities': len(initial['pending']), 'head': initial['head'],
                           'fullMapsRetained': False})
            recorded.add(setup)
        for mode, iteration in [('normal', 1), ('normal', 2), ('normal', 3), ('instrumented', 1)]:
            stem = f'{iteration:02d}-{name}'
            prefix = OWNER/'raw'/mode/stem
            metrics = read_object(prefix.with_suffix('.metrics.json'))
            proof = read_object(prefix.with_suffix('.posterior.json'))
            input_reference = read_object(prefix.with_suffix('.input.json'))
            final_evidence = read_object(prefix.with_suffix('.final.json'))
            if not proof['passed'] or metrics['outcome'] != 'exited' or metrics['exitCode'] != row['exit']:
                raise AssertionError('Unaccepted sample in export '+str(prefix))
            if input_reference['inputSha256'] != initial_hashes['complete']:
                raise AssertionError('Input canonical identity changed')
            final = final_evidence['raw']
            normalized = final_evidence['normalized']
            final_hashes = state_hashes(final)
            normalized_hashes = state_hashes(normalized)
            if normalized_hashes['complete'] != final_evidence['normalizedSha256']:
                raise AssertionError('Normalized complete identity changed')
            metric_name = 'metrics/'+mode+'/'+stem+'.json'
            writer.copied(metric_name, prefix.with_suffix('.metrics.json'))
            output = {channel: helper.stream_reference(writer, metrics[channel], prefix.with_suffix('.'+channel), streams) for channel in ('stdout', 'stderr')}
            changes = delta(initial, final, setup, prefix, proof)
            posterior = {**proof, 'initialWorktreeSha256': initial_hashes['worktree'], 'initialPendingSha256': initial_hashes['pending'],
                         'finalRawWorktreeSha256': final_hashes['worktree'], 'finalRawPendingSha256': final_hashes['pending'],
                         'finalNormalizedWorktreeSha256': normalized_hashes['worktree'], 'finalNormalizedPendingSha256': normalized_hashes['pending'],
                         'finalNormalizedCompleteSha256': normalized_hashes['complete'], 'headBefore': initial['head'], 'headAfter': final['head'],
                         'normalization': final_evidence['substitutions'], **changes}
            samples.append({'sample': mode+'/'+stem, 'setup': setup, 'metrics': metric_name, 'completeDisplayStreams': output, 'posterior': posterior})
        workload_file = OWNER/'counters'/('01-'+name)/'summary.json'
        raw_workload = read_object(workload_file)
        workload = helper.compact_workload(raw_workload)
        # Git stdin request lists are also long OID arrays; preserve identity, not each element.
        for entry, original in zip(workload['git'], raw_workload['git']):
            argv = original['argv']
            if len(argv) > 16 and '--' in argv:
                separator = argv.index('--')+1
                entry.pop('argv')
                entry['argvPrefix'] = argv[:separator]
                entry['originalArgvIdentity'] = {'count': len(argv), 'canonicalSha256': digest(canonical(argv))}
                pathspecs = argv[separator:]
                entry['omittedPathspecs'] = {'count': len(pathspecs), 'canonicalSha256': digest(canonical(pathspecs))}
            requests = original.get('requests', [])
            entry['omittedRequests'] = {'count': len(requests), 'canonicalSha256': digest(canonical(requests))}
        workload['originalSummaryIdentity'] = {'bytes': workload_file.stat().st_size, 'sha256': digest(workload_file.read_bytes())}
        writer.json('workloads/'+name+'.json', workload)
    if len(samples) != 252:
        raise AssertionError('Sample count changed')
    return samples, streams, inputs


def main() -> None:
    if sys.argv[1:] != ['--export-approved']:
        raise ValueError('Root-approved concise export required')
    if DESTINATION.exists():
        raise FileExistsError('Refusing to replace previous or partial export')
    DESTINATION.mkdir()
    writer = ExportWriter(DESTINATION, [], {})
    fixed = {
        'matrix.json': OWNER/'matrix.json', 'summary.json': OWNER/'summary.json', 'summary.md': OWNER/'summary.md',
        'observations.md': OWNER/'observations.md', 'equivalence.json': OWNER/'equivalence.json',
        'provenance/design.md': OWNER/'design.md', 'provenance/freeze.json': OWNER/'freeze.json',
        'provenance/preparation.json': OWNER/'preparation.json', 'provenance/environment.json': BENCH_ROOT/'results/environment.json',
        'provenance/protocol.md': BENCH_ROOT/'results/protocol.md', 'provenance/export-plan.md': Path(__file__).parent/'PLAN.md',
        'provenance/first-method-failure.md': Path(__file__).parent/'FIRST_METHOD_FAILURE.md',
        'provenance/counter-selfcheck-v4.json': OWNER/'instrumentation/selfcheck-summary-v4.json',
        'provenance/counter-independent-audit.json': BENCH_ROOT/'audit/counter-probes-v3/audit-results.json',
        'methods/collector.py': BENCH_ROOT/'methods/measure.py', 'methods/common-preload.mjs': OWNER/'instrumentation/preload.mjs',
        'methods/common-summarize.py': OWNER/'instrumentation/summarize.py', 'methods/probe-interface.md': OWNER/'instrumentation/INTERFACE.md',
        'methods/export.py': Path(__file__), 'methods/ir-export-format-reading-copy.py': HELPER,
        'methods/summarize-results.py': OWNER/'reporting/summarize-results.py',
    }
    for source in (OWNER/'methods').glob('*.py'):
        fixed['methods/'+source.name] = source
    for name, source in fixed.items():
        writer.copied(name, source)
    samples, streams, inputs = export_samples(writer)
    writer.write('samples.jsonl', display(b''.join(canonical(row)+b'\n' for row in samples)))
    writer.json('streams.json', list(streams.values()))
    writer.json('provenance/input-identities.json', inputs)
    writer.json('provenance/root-path-display.json', {'markers': [{'marker': marker, 'originalRootBytes': len(root.encode()), 'originalRootSha256': digest(root.encode())} for root, marker in helper.MARKERS.items()],
                                                   'rawByteCountsAndShaRetained': True, 'allRawBytesRetained': False, 'replayable': False})
    readme = '''# Decision 本轮测量简洁证据归档

63场景覆盖18命令；189正常样本+63独立probe，252完整metrics全部后验通过；189组完整输出及规范化末态等价通过。0正式边界三场景单列，不属于1万存量负载。

本包是经独立审计的保真摘要，不是完整重放包或原字节stdout/stderr归档。metrics与完整streams是精确根路径标记化的UTF-8展示副本；streams.json/file-integrity.jsonl保留原始bytes/SHA及展示bytes/SHA，原始流未覆盖。<BENCH_ROOT>表示当时临时证据根，<SOURCE_ROOT>表示当时主仓根。方法源码亦为形成时阅读副本，不能承诺从本包直接重跑。

原始采样的完整stdout/stderr零归一化比对，与本包展示路径替换是两件事。末态等价只对C首次createdAt及其依赖v2 revision作声明的精确替换；raw和normalized初末hash及逐样本normalization均保留。

保留：63场景/252完整metrics、SHA去重完整展示流、初末W/P canonical hash、精确变更小delta（SHA/bytes/mode/P对象/删除/空变化）、probe全部计数及Git实际payload/framing/初态角色、方法/冻结/规模指纹与首次方法失败说明。
省略：fixture/deps/snapshot、10k完整maps、大index正文、长paths/OIDs；工作量长列表保留count与canonicalSHA，不声称能从省略包重建全状态或重放。

JS/API读取/写入不是syscall或物理磁盘I/O。stdout/stderr的unknown-fd:1/2不计文件写；other中的docs临时发布文件与.git/index.lock是实际观察文件写，不应因index分类write0声称未写索引。Git原生内部FS盲区保留；HEAD/pending共享OID角色可重叠，不相加为总payload。
'''
    writer.write('README.md', readme.encode())
    writer.write('file-integrity.jsonl', display(b''.join(canonical(row)+b'\n' for row in writer.integrity)))
    for name, expected in writer.generated.items():
        if digest((DESTINATION/name).read_bytes()) != expected:
            raise AssertionError('Export readback failed '+name)
    print(json.dumps({'samples': len(samples), 'uniqueCompleteStreams': len(streams), 'readbackVerifiedFiles': len(writer.generated), 'output': str(DESTINATION)}))


if __name__ == '__main__':
    main()
`````

## `decision/methods/ir-export-format-reading-copy.py`

逻辑来源：`decision/methods/ir-export-format-reading-copy.py`、`investigation/methods/export.py`。

展示输入：13652 字节，SHA-256 `faad60981de4fcd7786b322a3cbadec42d8538550f6cd1d26975c92bc066d1c7`。

`````python
"""One-off readable evidence export; never invokes product or traverses fixtures."""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import sys

OWNER = Path(__file__).resolve().parents[1]
BENCH_ROOT = OWNER.parent
DESTINATION = Path(__file__).resolve().parent / 'bundle'
RAW = OWNER / 'raw/accepted-v1'
MARKERS = {str(BENCH_ROOT): '<BENCH_ROOT>', '<SOURCE_ROOT>': '<SOURCE_ROOT>'}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def read_object(path: Path) -> dict[str, object]:
    value: object = json.loads(path.read_bytes())
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ValueError('expected JSON object: ' + str(path))
    return {str(key): item for key, item in value.items()}


def object_field(value: dict[str, object], key: str) -> dict[str, object]:
    candidate = value.get(key)
    if not isinstance(candidate, dict) or not all(isinstance(name, str) for name in candidate):
        raise ValueError('expected object field: ' + key)
    return {str(name): item for name, item in candidate.items()}


def display(data: bytes) -> bytes:
    text = data.decode('utf-8', errors='strict')
    for original, marker in sorted(MARKERS.items(), key=lambda pair: -len(pair[0])):
        text = text.replace(original, marker)
    return text.encode('utf-8')


@dataclass
class ExportWriter:
    destination: Path
    integrity: list[dict[str, object]]
    generated: dict[str, str]

    def write(self, name: str, data: bytes) -> None:
        target = self.destination / name
        if not target.resolve().is_relative_to(self.destination):
            raise ValueError('export path escapes owned bundle')
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as output:
            output.write(data)
        self.generated[name] = digest(data)

    def copied(self, name: str, source: Path) -> None:
        original = source.read_bytes()
        rendered = display(original)
        self.write(name, rendered)
        self.integrity.append({
            'file': name,
            'source': str(source),
            'originalBytes': len(original),
            'originalSha256': digest(original),
            'displayBytes': len(rendered),
            'displaySha256': digest(rendered),
            'conversion': 'exact root-path text replacement; strict UTF-8; not original bytes',
        })

    def json(self, name: str, value: object) -> None:
        raw = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
        self.write(name, display(raw))


def stream_reference(writer: ExportWriter, identity: dict[str, object], source: Path,
                     streams: dict[str, dict[str, object]]) -> str:
    original = source.read_bytes()
    sha = digest(original)
    if identity.get('bytes') != len(original) or identity.get('sha256') != sha:
        raise AssertionError('raw stream differs from measured identity: ' + str(source))
    if sha not in streams:
        name = 'streams/' + sha + '.txt'
        rendered = display(original)
        writer.copied(name, source)
        streams[sha] = {
            'file': name,
            'originalBytes': len(original),
            'originalSha256': sha,
            'displayBytes': len(rendered),
            'displaySha256': digest(rendered),
        }
    return str(streams[sha]['file'])


def compact_workload(value: dict[str, object]) -> dict[str, object]:
    io_result = []
    for row in value['io']:
        paths = row['paths']
        io_result.append({
            **{key: item for key, item in row.items() if key != 'paths'},
            'omittedPaths': {'count': len(paths), 'canonicalSha256': digest(canonical(paths))},
        })
    git_result = []
    for command in value['git']:
        item = {key: command.get(key) for key in (
            'sequence', 'argv', 'exitCode', 'stdoutBytes', 'stderrBytes')}
        batch = command['batch']
        if batch is not None:
            blobs = batch.get('blobs', [])
            roles: dict[str, dict[str, int]] = {}
            for blob in blobs:
                role = '+'.join(blob['roles'])
                count = roles.setdefault(role, {'blobs': 0, 'payloadBytes': 0})
                count['blobs'] += 1
                count['payloadBytes'] += blob['bytes']
            item['batch'] = {
                **{key: field for key, field in batch.items() if key != 'blobs'},
                'initialObjectMembership': roles,
                'omittedBlobs': {'count': len(blobs), 'canonicalSha256': digest(canonical(blobs))},
            }
        else:
            item['batch'] = None
        git_result.append(item)
    return {
        **{key: item for key, item in value.items() if key not in {'io', 'git'}},
        'io': io_result,
        'git': git_result,
        'retention': 'counts, bytes, unique counts, framing, roles and boundaries retained; long paths/OID lists omitted with digest; not replayable',
    }


def state_delta(paths: list[str], before: dict[str, object], after: dict[str, object]) -> list[dict[str, object]]:
    actual = sorted(key for key in set(before) | set(after) if before.get(key) != after.get(key))
    if sorted(paths) != actual:
        raise AssertionError('retained posterior delta does not match complete audited manifests')
    return [{'path': path, 'before': before.get(path), 'after': after.get(path)} for path in paths]


def samples(writer: ExportWriter) -> tuple[list[dict[str, object]], dict[str, dict[str, object]], list[dict[str, object]]]:
    matrix_value: object = json.loads((OWNER / 'matrix.json').read_bytes())
    if not isinstance(matrix_value, list) or len(matrix_value) != 58:
        raise ValueError('expected approved 58-scenario matrix')
    results = []
    streams: dict[str, dict[str, object]] = {}
    inputs = []
    recorded_inputs: set[str] = set()
    for scenario in matrix_value:
        name = scenario['id']
        setup = scenario['setup']
        input_file = OWNER / 'prepared' / (setup + '.manifest.json')
        input_bytes = input_file.read_bytes()
        initial = read_object(input_file)
        if setup not in recorded_inputs:
            inputs.append({'setup': setup, 'manifestBytes': len(input_bytes), 'manifestSha256': digest(input_bytes), 'fullMapsRetained': False})
            recorded_inputs.add(setup)
        reference = None
        for iteration in range(4):
            stem = f'{iteration:02d}-{name}'
            metrics_file = RAW / (stem + '.metrics.json')
            metrics = read_object(metrics_file)
            posterior = read_object(RAW / (stem + '.posterior.json'))
            if posterior.get('passed') is not True:
                raise AssertionError('unaccepted posterior: ' + stem)
            signatures = {key: posterior[key] for key in (
                'inputWorktreeSha256', 'inputPendingSha256',
                'finalWorktreeSha256', 'finalPendingSha256')}
            if reference is None:
                reference = signatures
            elif reference != signatures:
                raise AssertionError('sample state equivalence changed: ' + stem)
            metric_name = 'metrics/' + stem + '.json'
            writer.copied(metric_name, metrics_file)
            output = {
                channel: stream_reference(writer, object_field(metrics, channel), RAW / (stem + '.' + channel), streams)
                for channel in ('stdout', 'stderr')
            }
            retained = {key: item for key, item in posterior.items() if key not in {'afterWorktree', 'afterPending'}}
            retained['worktreeDelta'] = state_delta(
                posterior['worktreeDelta'], object_field(initial, 'worktree'), object_field(posterior, 'afterWorktree'))
            retained['pendingDelta'] = state_delta(
                posterior['pendingDelta'], object_field(initial, 'pending'), object_field(posterior, 'afterPending'))
            results.append({'sample': stem, 'setup': setup, 'metrics': metric_name, 'completeDisplayStreams': output, 'posterior': retained})
        workload_file = RAW / ('03-' + name + '.workload.json')
        workload = compact_workload(read_object(workload_file))
        workload['originalSummaryIdentity'] = {'bytes': workload_file.stat().st_size, 'sha256': digest(workload_file.read_bytes())}
        writer.json('workloads/' + name + '.json', workload)
    if len(results) != 232:
        raise AssertionError('sample count changed')
    return results, streams, inputs


def main() -> None:
    if sys.argv[1:] != ['--export-approved']:
        raise ValueError('static preparation only; explicit post-DR export authorization is required')
    if DESTINATION.exists():
        raise FileExistsError('refusing to replace prior export or failed partial bundle')
    DESTINATION.mkdir()
    writer = ExportWriter(DESTINATION, [], {})
    fixed = {
        'matrix.json': OWNER / 'matrix.json',
        'normal-timings.csv': OWNER / 'normal-timings.csv',
        'workloads.csv': OWNER / 'workloads.csv',
        'results-summary.json': OWNER / 'results-summary.json',
        'summary.md': OWNER / 'summary.md',
        'observations.md': OWNER / 'observations.md',
        'provenance/design.md': OWNER / 'design.md',
        'provenance/formal-freeze.json': OWNER / 'formal-freeze.json',
        'provenance/instrumentation-manifest.json': OWNER / 'instrumentation-manifest.json',
        'provenance/instrumentation.patch': OWNER / 'instrumentation.patch',
        'provenance/preformal-file-manifest.json': OWNER / 'preformal-file-manifest.json',
        'provenance/fixture-summary.json': OWNER / 'fixture-summary.json',
        'provenance/smoke-v3.json': OWNER / 'smoke-evidence-v3/summary.json',
        'provenance/mutation-smoke.json': OWNER / 'mutation-smoke/summary.json',
        'provenance/oracle-sensitivity.json': BENCH_ROOT / 'audit/ir-posterior-sensitivity/audit-results.json',
        'provenance/environment.json': BENCH_ROOT / 'results/environment.json',
        'provenance/protocol.md': BENCH_ROOT / 'results/protocol.md',
        'provenance/export-plan.md': Path(__file__).parent / 'PLAN.md',
        'provenance/first-method-failure.md': Path(__file__).parent / 'FIRST_METHOD_FAILURE.md',
        'methods/collector.py': BENCH_ROOT / 'methods/measure.py',
        'methods/common-preload.mjs': BENCH_ROOT / 'decision/instrumentation/preload.mjs',
        'methods/common-summarize.py': BENCH_ROOT / 'decision/instrumentation/summarize.py',
        'methods/export.py': Path(__file__),
    }
    for source in (OWNER / 'methods').glob('*.py'):
        fixed['methods/' + source.name] = source
    for name, source in fixed.items():
        writer.copied(name, source)
    sample_rows, streams, inputs = samples(writer)
    writer.write('samples.jsonl', display(b''.join(canonical(row) + b'\n' for row in sample_rows)))
    writer.json('streams.json', list(streams.values()))
    writer.json('provenance/input-identities.json', inputs)
    readme = """# IR 本轮测量证据归档

58场景、174正常样本、58独立probe；全部真实CLI后验及原始流/初末状态等价检查通过。
本包是原始材料经独立审计后的保真摘要，不是完整重放包。

完整metrics与stdout/stderr均为根路径标记化的展示副本；streams.json和file-integrity.jsonl保留原始bytes数/SHA及展示bytes数/SHA，不声称展示流逐字节等于原流。原始采样中normal/probe的零归一化等价与本包展示转换是两件事。

<BENCH_ROOT>表示本轮临时证据根，<SOURCE_ROOT>表示当时主仓源码根。仅替换精确根路径文本；严格UTF-8，不删日志行。方法源码也为形成时阅读副本，路径常量可能经过展示转换，不能据此承诺直接重跑。

保留：matrix、3样本min/median/max统计、232完整metrics、去重完整流、逐样本后验关键字段/初末hash及小delta（mode/P对象身份/删除/空变化）、probe全部计数/framing/角色、方法及冻结/自证摘要。
省略：fixture/依赖/snapshot副本、每样本1W完整状态maps和大index正文、probe长路径与OID逐项列表；后者保留规范序列SHA及计数。没有从省略后的包重建全状态hash的声明。

samples.jsonl的before/after只描述实际变化路径；未变化范围由当时完整manifest的独立后验与初末hash证明。input-identities.json列初态manifest身份与setup，非当前可访问路径承诺。
"""
    writer.write('README.md', readme.encode())
    writer.json('provenance/root-path-display.json', {
        'markers': [
            {'marker': marker, 'originalRootBytes': len(original.encode()), 'originalRootSha256': digest(original.encode())}
            for original, marker in MARKERS.items()
        ],
        'rawByteCountsAndShaRetained': True,
        'allRawBytesRetained': False,
        'replayable': False,
    })
    writer.write('file-integrity.jsonl', display(b''.join(canonical(row) + b'\n' for row in writer.integrity)))
    for name, expected in writer.generated.items():
        if digest((DESTINATION / name).read_bytes()) != expected:
            raise AssertionError('export readback hash differs: ' + name)
    print(json.dumps({'samples': len(sample_rows), 'uniqueCompleteStreams': len(streams), 'output': str(DESTINATION), 'readbackVerifiedFiles': len(writer.generated)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
`````

## `decision/methods/oracle.py`

逻辑来源：`decision/methods/oracle.py`。

展示输入：26511 字节，SHA-256 `8161b8b5a4e02cb5dc8dfbec5ceea6a4f978822c74278e56de9dff174fb4f0ce`。

`````python
"""Independent YAML/JSON/Git posterior; does not import or call product validators."""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import subprocess
import re
import os
from typing import Mapping
import yaml

class DecisionYamlLoader(yaml.SafeLoader):
    """YAML timestamp-looking scalars are strings in the JSON-facing record contract."""
DecisionYamlLoader.yaml_implicit_resolvers = {key: [(tag, expression) for tag, expression in resolvers if tag != 'tag:yaml.org,2002:timestamp'] for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()}

@dataclass(frozen=True)
class Document:
    source: str
    metadata: Mapping[str, object]
    body: str
    raw: bytes

@dataclass(frozen=True)
class State:
    documents: Mapping[str, Document]
    files: Mapping[str, str]
    modes: Mapping[str, int]
    workspace_files: Mapping[str, str]
    workspace_modes: Mapping[str, int]
    index: dict[str, object] | None
    index_bytes: bytes | None
    pending: Mapping[str, tuple[str, str]]
    head: str
FIELDS = ('title', 'status', 'alignment', 'createdAt', 'purpose', 'background', 'decision', 'tags', 'relations')

def git(root: Path, *args: str, input_bytes: bytes | None=None) -> bytes:
    return subprocess.check_output(['git', '-C', str(root), *args], input=input_bytes)

def fingerprint(label: str, fields: list[str]) -> str:
    digest = hashlib.sha256((label + '\x00').encode())
    for field in fields:
        data = field.encode('utf8')
        digest.update(str(len(data)).encode() + b':' + data + b'\x00')
    return 'sha256:' + digest.hexdigest()

def parse_document(source: str, raw: bytes) -> Document:
    text = raw.decode('utf8').removeprefix('\ufeff').replace('\r\n', '\n')
    if not text.startswith('---\n'):
        raise ValueError(f'{source}: missing frontmatter')
    header, separator, body = text[4:].partition('\n---\n')
    if not separator:
        raise ValueError(f'{source}: missing frontmatter end')
    metadata = yaml.load(header, Loader=DecisionYamlLoader)
    if not isinstance(metadata, dict) or not isinstance(metadata.get('id'), str):
        raise ValueError(f'{source}: invalid metadata')
    return Document(source, metadata, body.lstrip('\n'), raw)

def snapshot(root: Path) -> State:
    collection = root / 'docs/decisions'
    docs: dict[str, Document] = {}
    files = {}
    modes = {}
    for file in sorted(collection.rglob('*')):
        if not file.is_file():
            continue
        raw = file.read_bytes()
        relative = file.relative_to(collection).as_posix()
        files[relative] = hashlib.sha256(raw).hexdigest()
        modes[relative] = file.stat().st_mode & 511
        if file.suffix == '.md':
            doc = parse_document(relative, raw)
            identity = doc.metadata['id']
            if identity in docs:
                raise ValueError(f'duplicate {identity}')
            docs[identity] = doc
    index_file = collection / 'decision-index.json'
    index_bytes = index_file.read_bytes() if index_file.exists() else None
    index = json.loads(index_bytes) if index_bytes is not None else None
    pending = {}
    for entry in git(root, 'ls-files', '--stage', '-z').split(b'\x00'):
        if not entry:
            continue
        metadata, p = entry.split(b'\t', 1)
        mode, oid, stage = metadata.decode().split()
        if stage != '0':
            raise ValueError('Unmerged index')
        pending[p.decode()] = (mode, oid)
    workspace_files = {}
    workspace_modes = {}
    for directory, names, filenames in os.walk(root):
        names[:] = [name for name in names if name != '.git']
        for name in filenames:
            file = Path(directory)/name
            relative = file.relative_to(root).as_posix()
            if file.is_symlink():
                raise ValueError('Unexpected workspace symlink '+relative)
            workspace_files[relative] = hashlib.sha256(file.read_bytes()).hexdigest()
            workspace_modes[relative] = file.stat().st_mode & 0o777
    return State(docs, files, modes, workspace_files, workspace_modes, index, index_bytes, pending, git(root, 'rev-parse', 'HEAD').decode().strip())

def verify_sources(state: State, require_current: bool=True) -> dict[str, object]:
    formal = {i: d for i, d in state.documents.items() if d.metadata['status'] != 'candidate'}
    candidates = {i: d for i, d in state.documents.items() if d.metadata['status'] == 'candidate'}
    for identity, doc in state.documents.items():
        meta = doc.metadata
        status = meta['status']
        assert status in ('candidate', 'active', 'archived'), identity
        assert doc.source.startswith('archive/') == (status == 'archived'), identity
        assert isinstance(meta['tags'], list) and meta['tags'], identity
        assert all((section in doc.body for section in ('## 目的', '## 背景', '## 决策'))), identity
        if status == 'candidate':
            assert meta['alignment'] is None and meta['createdAt'] is None, identity
        else:
            assert meta['alignment'] in ('aligned', 'unaligned') and isinstance(meta['createdAt'], str), identity
    edges = 0
    for identity, doc in formal.items():
        for relation in doc.metadata['relations']:
            target = relation['target']
            assert target in formal, (identity, target)
            assert formal[target].metadata['status'] == 'archived', (identity, target)
            edges += 1
    visiting = set()
    visited = set()

    def visit(identity: str) -> None:
        assert identity not in visiting, 'cycle'
        if identity in visited:
            return
        visiting.add(identity)
        for relation in formal[identity].metadata['relations']:
            visit(relation['target'])
        visiting.remove(identity)
        visited.add(identity)
    for identity in formal:
        visit(identity)
    if state.index is None:
        assert not formal, 'formal records require an index'
    elif require_current:
        index = state.index
        assert index['schemaVersion'] == 4 and index['namespace'] == 'decisions' and index['definitionVersion'] == 11, 'Unexpected frozen index envelope'
        assert set(index['entries']) == set(formal), 'index member mismatch'
        assert index['metadata'] == {}, 'unexpected collection metadata'
        assert index['sourceRevision']['metadata'] == fingerprint('decision-index-metadata-v2', ['{}'])
        assert set(index['sourceRevision']['entries']) == set(formal)
        for identity, doc in formal.items():
            expected = {key: doc.metadata[key] for key in FIELDS}
            expected['name'] = identity[7:]
            expected['sourcePath'] = doc.source
            assert index['entries'][identity] == expected, ('projection', identity)
            revision = fingerprint('decision-index-entry-v2', [identity, doc.source, doc.raw.decode('utf8').replace('\r\n', '\n')])
            assert index['sourceRevision']['entries'][identity] == revision, ('revision', identity)
    return {'formal': len(formal), 'candidates': len(candidates), 'edges': edges, 'files': len(state.files), 'indexCurrentChecked': require_current}

def assert_documents_unchanged(before: State, after: State, except_ids: set[str]) -> None:
    left = {i: d for i, d in before.documents.items() if i not in except_ids}
    right = {i: d for i, d in after.documents.items() if i not in except_ids}
    assert left == right, 'unselected document bytes changed'

def metadata_except(doc: Document, keys: set[str]) -> dict[str, object]:
    return {key: value for key, value in doc.metadata.items() if key not in keys}

A = '261001-record-09001'
B = '261001-record-09002'
Z = '261001-record-10000'
C = '261001-candidate-1'
INDEX = 'decision-index.json'


def is_zero_write(row: Mapping[str, object]) -> bool:
    key = str(row['id'])
    command = row['argv'][0]
    return command in ('list', 'show', 'search', 'trace', 'candidates', 'show-candidate', 'check') or 'preflight' in key or 'refuse' in key or key.endswith('-noop') or key.endswith('-current')


def selected_successors(argv: list[str]) -> list[str]:
    return [value.split('=', 1)[1] for index, value in enumerate(argv) if index and argv[index-1] == '--successor']


def publication_predecessors(row: Mapping[str, object], before: State) -> set[str]:
    argv = row['argv']
    successors = [C] if argv[0] == 'publish' else selected_successors(argv)
    override = [value.split('=', 1)[1] for index, value in enumerate(argv) if index and argv[index-1] == '--relation']
    targets = override or [relation['target'] for identity in successors for relation in before.documents[identity].metadata['relations']]
    return {target for target in targets if before.documents[target].metadata['status'] == 'active'}


def expected_worktree_changes(row: Mapping[str, object], before: State, after: State) -> set[str]:
    argv = row['argv']
    command = argv[0]
    if is_zero_write(row) or command == 'stage':
        return set()
    if command == 'new':
        added = set(after.documents)-set(before.documents)
        assert len(added) == 1, 'new must add exactly one identity'
        assert after.documents[next(iter(added))].source == 'candidate-new.md'
        return {'candidate-new.md'}
    if command == 'sync-index':
        return {INDEX}
    if command in ('publish', 'evolve'):
        successors = [C] if command == 'publish' else selected_successors(argv)
        paths = {INDEX}
        for identity in successors:
            assert after.documents[identity].source == before.documents[identity].source
            paths.add(before.documents[identity].source)
        for identity in publication_predecessors(row, before):
            paths.update((before.documents[identity].source, 'archive/'+Path(before.documents[identity].source).name))
        if '--discard' in argv:
            paths.add(before.documents[argv[argv.index('--discard')+1]].source)
        return paths
    if command in ('set-relations', 'mark-aligned', 'archive', 'reactivate'):
        identity = A if command == 'set-relations' else argv[1]
        old_source = before.documents[identity].source
        expected_source = 'archive/'+Path(old_source).name if command == 'archive' else Path(old_source).name if command == 'reactivate' else old_source
        assert after.documents[identity].source == expected_source
        return {INDEX, old_source, expected_source}
    if command == 'discard':
        doc = before.documents[argv[1]]
        return {doc.source} if doc.metadata['status'] == 'candidate' else {doc.source, INDEX}
    if command == 'rename':
        old_id = argv[1]
        new_id = old_id[:7]+argv[2]
        doc = before.documents[old_id]
        incoming = {identity for identity, source in before.documents.items() if any(rel['target'] == old_id for rel in source.metadata['relations'])}
        new_source = ('archive/' if doc.metadata['status'] == 'archived' else '')+argv[2]+'.md'
        assert after.documents[new_id].source == new_source
        paths = {doc.source, new_source}
        paths.update(before.documents[identity].source for identity in incoming)
        if doc.metadata['status'] != 'candidate':
            paths.add(INDEX)
        return paths
    raise ValueError('Missing footprint rule '+str(row['id']))


def assert_footprint(row: Mapping[str, object], before: State, after: State) -> set[str]:
    all_paths = set(before.files) | set(after.files)
    changed = {locator for locator in all_paths if before.files.get(locator) != after.files.get(locator) or before.modes.get(locator) != after.modes.get(locator)}
    expected = expected_worktree_changes(row, before, after)
    workspace_changed = {locator for locator in set(before.workspace_files) | set(after.workspace_files) if before.workspace_files.get(locator) != after.workspace_files.get(locator) or before.workspace_modes.get(locator) != after.workspace_modes.get(locator)}
    assert workspace_changed == {'docs/decisions/'+locator for locator in expected}, ('workspace escaped domain write set', workspace_changed)
    assert changed == expected, ('exact worktree footprint', row['id'], sorted(expected), sorted(changed))
    umask_match = re.search(r'^Umask:\s+([0-7]+)$', Path('/proc/self/status').read_text(), re.MULTILINE)
    if umask_match is None:
        raise ValueError('Cannot establish inherited Linux umask')
    creation_mode = 0o666 & ~int(umask_match[1], 8)
    for locator in expected & set(after.modes):
        wanted_mode = before.modes.get(locator, creation_mode)
        if locator not in before.modes and locator.endswith('.md'):
            identity = next(identity for identity, document in after.documents.items() if document.source == locator)
            old_identity = row['argv'][1] if row['argv'][0] == 'rename' else identity
            if old_identity in before.documents:
                wanted_mode = before.modes[before.documents[old_identity].source]
        assert after.modes[locator] == wanted_mode, ('unexpected mode', locator, wanted_mode, after.modes[locator])
    return changed


def verify_stage(root: Path, row: Mapping[str, object], before: State, after: State) -> None:
    scope = row['argv'][-1]
    domain_path = 'docs/decisions/'+before.documents[A].source
    index_path = 'docs/decisions/'+INDEX
    changed = {locator for locator in set(before.pending) | set(after.pending) if before.pending.get(locator) != after.pending.get(locator)}
    expected = set() if str(row['id']).endswith('-unchanged') else {domain_path, index_path} if scope == 'all' else {domain_path if scope == 'domain' else index_path}
    assert changed == expected, ('exact pending footprint', row['id'], expected, changed)
    if scope in ('domain', 'all'):
        mode, oid = after.pending[domain_path]
        assert mode == '100644'
        assert git(root, 'cat-file', 'blob', oid) == before.documents[A].raw
    if scope in ('index', 'all'):
        pending_index = json.loads(git(root, 'cat-file', 'blob', after.pending[index_path][1]))
        old_index = json.loads(git(root, 'cat-file', 'blob', before.pending[index_path][1]))
        for field in ('entries',):
            assert pending_index[field][A] == before.index[field][A]
            assert {identity: value for identity, value in pending_index[field].items() if identity != A} == {identity: value for identity, value in old_index[field].items() if identity != A}
        assert pending_index['sourceRevision']['entries'][A] == before.index['sourceRevision']['entries'][A]
        assert {identity: value for identity, value in pending_index['sourceRevision']['entries'].items() if identity != A} == {identity: value for identity, value in old_index['sourceRevision']['entries'].items() if identity != A}
        assert {key: value for key, value in pending_index.items() if key not in ('entries', 'sourceRevision')} == {key: value for key, value in old_index.items() if key not in ('entries', 'sourceRevision')}
        assert pending_index['sourceRevision']['metadata'] == old_index['sourceRevision']['metadata']
    if scope == 'domain':
        assert before.pending[index_path] == after.pending[index_path]


def verify_publication(row: Mapping[str, object], before: State, after: State) -> None:
    argv = row['argv']
    successors = [C] if argv[0] == 'publish' else selected_successors(argv)
    changed = set(successors)
    for identity in publication_predecessors(row, before):
        changed.add(identity)
        old = before.documents[identity]
        new = after.documents[identity]
        assert new.metadata['status'] == 'archived'
        assert new.body == old.body
        assert metadata_except(old, {'status'}) == metadata_except(new, {'status'})
    if '--discard' in argv:
        discarded = argv[argv.index('--discard')+1]
        changed.add(discarded)
        assert discarded not in after.documents
    overrides = [{'type': value.split('=', 1)[0], 'target': value.split('=', 1)[1]} for index, value in enumerate(argv) if index and argv[index-1] == '--relation']
    summary_values = [value.split('=', 1) for index, value in enumerate(argv) if index and argv[index-1] == '--relation-summary']
    for relation in overrides:
        summary = next((summary for target, summary in summary_values if target == relation['target']), None)
        if summary is not None:
            relation['summary'] = summary
    for identity in successors:
        old = before.documents[identity]
        new = after.documents[identity]
        alignment = argv[argv.index('--alignment')+1] if argv[0] == 'publish' else next(value.split('=', 1)[0] for index, value in enumerate(argv) if index and argv[index-1] == '--successor' and value.split('=', 1)[1] == identity)
        assert new.metadata['status'] == 'active'
        assert new.metadata['alignment'] == alignment
        assert new.metadata['createdAt']
        if old.metadata['createdAt'] is not None:
            assert old.metadata['createdAt'] == new.metadata['createdAt']
        assert new.metadata['relations'] == (overrides if overrides else old.metadata['relations'])
        assert new.body == old.body
        assert metadata_except(old, {'status', 'alignment', 'createdAt', 'relations'}) == metadata_except(new, {'status', 'alignment', 'createdAt', 'relations'})
    assert_documents_unchanged(before, after, changed)


def verify_rename(row: Mapping[str, object], before: State, after: State) -> None:
    argv = row['argv']
    old_id = argv[1]
    new_id = old_id[:7]+argv[2]
    assert old_id not in after.documents and new_id in after.documents
    assert set(after.documents) == (set(before.documents)-{old_id}) | {new_id}
    for identity, old in before.documents.items():
        target = new_id if identity == old_id else identity
        new = after.documents[target]
        expected = dict(old.metadata)
        expected['id'] = target
        expected['relations'] = [{**relation, 'target': new_id if relation['target'] == old_id else relation['target']} for relation in old.metadata['relations']]
        assert new.metadata == expected, (identity, 'rename metadata')
        assert new.body == old.body
    if before.documents[old_id].metadata['status'] == 'candidate':
        assert before.index_bytes == after.index_bytes


def verify_local_mutation(row: Mapping[str, object], before: State, after: State) -> None:
    argv = row['argv']
    command = argv[0]
    if command == 'new':
        added = set(after.documents)-set(before.documents)
        new = after.documents[next(iter(added))]
        assert new.metadata['status'] == 'candidate'
        assert new.metadata['title'] == 'Benchmark new'
        assert new.metadata['purpose'] == '固定目的' and new.metadata['background'] == '固定背景' and new.metadata['decision'] == '固定选择'
        assert new.metadata['tags'] == ['benchmark']
        assert_documents_unchanged(before, after, added)
        assert before.index_bytes == after.index_bytes
    elif command == 'set-relations':
        assert after.documents[A].metadata['relations'] == []
        assert metadata_except(before.documents[A], {'relations'}) == metadata_except(after.documents[A], {'relations'})
        assert before.documents[A].body == after.documents[A].body
        assert_documents_unchanged(before, after, {A})
    elif command in ('mark-aligned', 'archive', 'reactivate'):
        identity = argv[1]
        old = before.documents[identity]
        new = after.documents[identity]
        field = 'alignment' if command == 'mark-aligned' else 'status'
        expected = 'aligned' if command == 'mark-aligned' else 'archived' if command == 'archive' else 'active'
        assert new.metadata[field] == expected
        mutable = {field, 'alignment'} if command == 'reactivate' else {field}
        if command == 'reactivate':
            assert new.metadata['alignment'] == argv[argv.index('--alignment')+1]
        assert metadata_except(old, mutable) == metadata_except(new, mutable)
        assert old.body == new.body
        assert_documents_unchanged(before, after, {identity})
    elif command == 'sync-index':
        assert before.documents == after.documents
    elif command == 'discard':
        identity = argv[1]
        assert identity not in after.documents
        assert_documents_unchanged(before, after, {identity})
        if before.documents[identity].metadata['status'] == 'candidate':
            assert before.index_bytes == after.index_bytes
    else:
        raise ValueError('Missing semantic posterior '+str(row['id']))


def verify_queries(row: Mapping[str, object], state: State, stdout: str, stderr: str) -> None:
    key = str(row['id'])
    command = row['argv'][0]
    formal = {identity: doc for identity, doc in state.documents.items() if doc.metadata['status'] != 'candidate'}
    active = sorted(identity for identity, doc in formal.items() if doc.metadata['status'] == 'active')
    if row['exit'] != 0:
        assert stderr.strip(), 'refusal must include diagnostics'
        if key == 'content-budget-refuse':
            assert re.search(r'budget|bytes|size|limit', stderr, re.IGNORECASE), 'missing budget diagnosis'
        return
    if command in ('show', 'show-candidate'):
        doc = state.documents[row['argv'][1]]
        assert doc.raw.decode('utf8').strip() in stdout, 'complete original Markdown not returned'
        if key == 'show-current':
            assert stderr.strip(), 'missing stale revision warning'
    elif command == 'list':
        returned = re.findall(r'^- (?:(?:active|archived) (?:aligned|unaligned) \S+ )?(\d{6}-[a-z0-9-]+)(?: |$)', stdout, re.MULTILINE)
        expected = ['261001-record-08001'] if key == 'list-relations' else active[:10]
        total = 1 if key == 'list-relations' else len(active)
        assert returned == expected, ('list members/order', returned, expected)
        assert f'Showing {len(expected)} of {total} matches' in stdout
        assert 'kind=published-index currentness=unchecked fallback=false' in stdout
        if key == 'list-relations':
            assert A+' --修订--> 261001-record-08001' in stdout
    elif command == 'search':
        returned = re.findall(r'^- (?:active|archived) (?:aligned|unaligned) \S+ (\d{6}-[a-z0-9-]+)$', stdout, re.MULTILINE)
        if key in ('metadata-relations', 'content-small'):
            expected = ['261001-record-08001']
            assert 'Counts: matched=1 precision=exact returned=1' in stdout
            assert A+' --修订--> 261001-record-08001' in stdout
        elif key == 'metadata':
            expected = active[:10]
            assert f'Counts: matched={len(active)} precision=exact returned=10' in stdout
            assert 'scan=complete results=limited previews=n/a' in stdout
        elif key == 'content-return-limit':
            expected = active[:20]
            assert 'Counts: matched>=21 precision=lower-bound returned=20' in stdout
            assert 'scan=limited results=limited' in stdout
            assert 'max-records' in stderr
        else:
            raise ValueError('Missing search result oracle '+key)
        assert returned == expected, ('search members/order', returned, expected)
        source = 'published-index' if key.startswith('metadata') else 'published-index+current-text'
        assert f'Source: kind={source} currentness=unchecked fallback=false' in stdout
    elif command == 'candidates':
        returned = re.findall(r'^- candidate (\d{6}-[a-z0-9-]+)', stdout, re.MULTILINE)
        expected = sorted(identity for identity, doc in state.documents.items() if doc.metadata['status'] == 'candidate')
        assert returned == expected, ('candidate members', returned, expected)
        assert stdout.count('bodyReady: true') == len(expected)
    elif command == 'trace':
        value = json.loads(stdout)
        assert value['status'] == 'ok' and value['anchorId'] == A
        assert value['source'] == {'kind': 'published-index', 'currentness': 'unchecked', 'fallback': False}
        if key == 'trace':
            expected = {f'261001-record-{level*1000+1:05d}' for level in range(10)}
            assert set(value['traceIds']) == expected and value['contextIds'] == []
            assert set(value['entries']) == expected and value['coverage']['complete'] is True
            assert value['frontier'] == []
        else:
            assert set(value['traceIds']) == {A, '261001-record-08001'}
            assert value['coverage']['complete'] is False and value['frontier']
        for identity, entry in value['entries'].items():
            assert entry['relations'] == state.index['entries'][identity]['relations']


def posterior(root: Path, row: dict[str, object], before: State, after: State, exit_code: int, stdout: str, stderr: str) -> dict[str, object]:
    key = str(row['id'])
    argv = row['argv']
    command = argv[0]
    assert exit_code == row['exit'], ('exit', key, exit_code, row['exit'], stderr)
    assert before.head == after.head, 'CLI changed HEAD'
    changed = assert_footprint(row, before, after)
    if before.index is not None and after.index is not None:
        envelope = lambda index: {key: value for key, value in index.items() if key not in ('entries', 'sourceRevision')}
        assert envelope(before.index) == envelope(after.index), 'Index envelope changed'
        assert before.index['sourceRevision']['metadata'] == after.index['sourceRevision']['metadata'], 'Collection revision metadata changed'
    if command == 'stage':
        verify_stage(root, row, before, after)
    else:
        assert before.pending == after.pending, 'non-stage changed pending'
        if not is_zero_write(row):
            if command in ('publish', 'evolve'):
                verify_publication(row, before, after)
            elif command == 'rename':
                verify_rename(row, before, after)
            else:
                verify_local_mutation(row, before, after)
    current = not (row['setup'] in ('body-edit', 'oversize-P') and (is_zero_write(row) or command != 'sync-index'))
    proof = verify_sources(after, current)
    verify_queries(row, after, stdout, stderr)
    return {'scenario': key, 'exit': exit_code, 'passed': True, 'sourceProof': proof, 'worktreeChangedPaths': sorted(changed),
            'pendingChangedPaths': sorted(locator for locator in set(before.pending) | set(after.pending) if before.pending.get(locator) != after.pending.get(locator))}
`````

## `decision/methods/outcomes.py`

逻辑来源：`decision/methods/outcomes.py`。

展示输入：5513 字节，SHA-256 `36f2ce5cd2b9b1729369f82636188a5199e42bfd5978dcf75d506a9e80b048f8`。

`````python
"""Retain exact final evidence and compare normal/probe output and final-state equivalence."""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import re

from oracle import State, fingerprint

CANDIDATE = '261001-candidate-1'


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def final_manifest(state: State) -> dict[str, object]:
    return {'files': dict(state.workspace_files), 'modes': dict(state.workspace_modes), 'pending': dict(state.pending), 'head': state.head}


def normalized_manifest(row: dict[str, object], before: State, after: State) -> tuple[dict[str, object], list[dict[str, str]]]:
    manifest = final_manifest(after)
    substitutions = []
    # Only candidate establishment generates a wall-clock field in this matrix.
    # Exact timestamp and its dependent v2 revision are the only byte substitutions.
    if row['argv'][0] in ('publish', 'evolve') and 'preflight' not in str(row['id']):
        prior = before.documents.get(CANDIDATE)
        current = after.documents.get(CANDIDATE)
        if prior is not None and current is not None and prior.metadata['createdAt'] is None and current.metadata['createdAt'] is not None:
            timestamp = current.metadata['createdAt']
            raw = current.raw.decode('utf8')
            normalized, count = re.subn(r'(?m)^(createdAt:\s*["\']?)'+re.escape(timestamp)+r'(["\']?\s*)$', r'\g<1><ESTABLISHED_AT>\g<2>', raw)
            if count != 1:
                raise ValueError('Expected one generated createdAt source field')
            locator = 'docs/decisions/'+current.source
            manifest['files'][locator] = hashlib.sha256(normalized.encode()).hexdigest()
            actual_revision = after.index['sourceRevision']['entries'][CANDIDATE]
            normalized_revision = fingerprint('decision-index-entry-v2', [CANDIDATE, current.source, normalized.replace('\r\n', '\n')])
            index_bytes = after.index_bytes.decode('utf8')
            if index_bytes.count(timestamp) != 1 or index_bytes.count(actual_revision) != 1:
                raise ValueError('Generated createdAt/revision index substitution not unique')
            normalized_index = index_bytes.replace(timestamp, '<ESTABLISHED_AT>').replace(actual_revision, normalized_revision)
            manifest['files']['docs/decisions/decision-index.json'] = hashlib.sha256(normalized_index.encode()).hexdigest()
            substitutions = [{'identity': CANDIDATE, 'field': 'createdAt', 'actual': timestamp, 'canonical': '<ESTABLISHED_AT>'},
                             {'identity': CANDIDATE, 'field': 'sourceRevision.entries', 'actual': actual_revision, 'canonical': normalized_revision}]
    return manifest, substitutions


def save_final(prefix: Path, root: Path, row: dict[str, object], before: State, after: State) -> None:
    changed = [locator for locator in set(before.workspace_files) | set(after.workspace_files) if before.workspace_files.get(locator) != after.workspace_files.get(locator) or before.workspace_modes.get(locator) != after.workspace_modes.get(locator)]
    delta = prefix.parent/(prefix.name+'.final-files')
    delta.mkdir()
    deleted = []
    for locator in changed:
        source = root/locator
        if not source.exists():
            deleted.append(locator)
            continue
        target = delta/locator
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as output:
            output.write(source.read_bytes())
    normalized, substitutions = normalized_manifest(row, before, after)
    value = {'raw': final_manifest(after), 'normalized': normalized, 'substitutions': substitutions,
             'normalizedSha256': hashlib.sha256(canonical(normalized)).hexdigest(), 'deletedPaths': sorted(deleted), 'actualChangedFileBytes': str(delta)}
    with prefix.with_suffix('.final.json').open('x') as output:
        output.write(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def compare_domain(domain: Path) -> dict[str, object]:
    rows = json.loads((domain/'matrix.json').read_text())['scenarios']
    comparisons = []
    for row in rows:
        key = row['id']
        normal_prefixes = [domain/'raw/normal'/f'{iteration:02d}-{key}' for iteration in (1, 2, 3)]
        probe = domain/'raw/instrumented'/f'01-{key}'
        reference = normal_prefixes[0]
        expected = json.loads(reference.with_suffix('.final.json').read_text())
        for candidate in normal_prefixes[1:]+[probe]:
            actual = json.loads(candidate.with_suffix('.final.json').read_text())
            assert expected['normalized'] == actual['normalized'], ('final-state equivalence', key, str(candidate))
            for stream in ('stdout', 'stderr'):
                # This matrix's CLI mutation output does not print generated createdAt.
                # Full stream bytes must match; no broad timestamp/path removal.
                assert reference.with_suffix('.'+stream).read_bytes() == candidate.with_suffix('.'+stream).read_bytes(), ('complete output equivalence', key, stream, str(candidate))
            comparisons.append({'scenario': key, 'reference': str(reference), 'candidate': str(candidate), 'passed': True,
                                'finalNormalizedSha256': actual['normalizedSha256'], 'allowedSubstitutions': actual['substitutions']})
    return {'passed': True, 'comparisons': comparisons, 'count': len(comparisons)}
`````

## `decision/methods/prepare.py`

逻辑来源：`decision/methods/prepare.py`。

展示输入：7070 字节，SHA-256 `20a171ae22171a0b985f4e416e7eb5bf77db8492526c5b53d7e5beb7bfc549de`。

`````python
"""Construct owned, frozen setup fixtures; never writes product or source fixture."""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

from oracle import snapshot, verify_sources, git

DOMAIN = Path(__file__).resolve().parents[1]
ROOT = DOMAIN.parent
CLI = ROOT/'snapshot/skills/decision-records/scripts/decision-records.ts'
SOURCE = Path('<FIXTURE_SOURCE>')
SOURCE_HEAD = '9fdb438d'
A = '261001-record-09001'
B = '261001-record-09002'
Z = '261001-record-10000'
C = '261001-candidate-1'


def run(root: Path, argv: list[str], label: str) -> None:
    result = subprocess.run(argv, cwd=root, capture_output=True)
    output = DOMAIN/'raw/preparation'
    output.mkdir(exist_ok=True)
    prefix = output/label
    if prefix.with_suffix('.stdout').exists():
        raise ValueError('Refusing preparation evidence overwrite '+label)
    prefix.with_suffix('.stdout').write_bytes(result.stdout)
    prefix.with_suffix('.stderr').write_bytes(result.stderr)
    if result.returncode:
        raise RuntimeError(f'Preparation failed {label}: {result.returncode}: '+result.stderr.decode())


def cli(root: Path, *args: str, label: str) -> None:
    run(root, ['node', str(CLI), '--root', str(root), *args], label)


def initialize_git(root: Path) -> None:
    git(root, 'init', '-q')
    git(root, 'config', 'user.name', 'Benchmark Fixture')
    git(root, 'config', 'user.email', 'fixture@example.invalid')
    git(root, 'config', 'core.hooksPath', '/dev/null')
    git(root, 'add', '.')
    git(root, 'commit', '-qm', 'Fixed current-format 10000-record fixture')
    assert not git(root, 'remote').strip()


def append_body(root: Path, identity: str, marker: str) -> None:
    file = root/'docs/decisions'/f'{identity}.md'
    with file.open('ab') as output:
        output.write(f'\n{marker}\n'.encode())


def copy_fixture(base: Path, target: Path) -> None:
    if target.exists():
        raise ValueError('Fixture already exists '+str(target))
    shutil.copytree(base, target, copy_function=shutil.copy2)


def export_base(target: Path, small: bool) -> None:
    target.mkdir()
    archive = subprocess.check_output(['git', '-C', str(SOURCE), 'archive', SOURCE_HEAD, 'docs/decisions'])
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        bundle.extractall(target, filter='data')
    collection = target/'docs/decisions'
    (collection/'decision-index.json').unlink()
    if small:
        retained = {f'261001-record-{level*1000+group:05d}' for level in range(10) for group in (1, 2)}
        retained.update(('261001-candidate-1', '261001-candidate-2'))
        for file in collection.rglob('*.md'):
            if file.stem not in retained:
                file.unlink()
    cli(target, 'sync-index', label='small-base-sync' if small else 'base-sync')
    initialize_git(target)
    proof = verify_sources(snapshot(target))
    assert proof['formal'] == (20 if small else 10000)
    assert proof['edges'] == (18 if small else 9000)
    assert proof['candidates'] == 2
    (target/'fixture-proof.json').write_text(json.dumps(proof, indent=2)+'\n')


def prepare_setups(base: Path) -> None:
    setups = sorted({row['setup'] for row in json.loads((DOMAIN/'matrix.json').read_text())['scenarios']})
    for setup in setups:
        if setup == 'base':
            continue
        target = base.parent/setup
        copy_fixture(base, target)
        collection = target/'docs/decisions'
        if setup == 'canonical-name-paths':
            for identity in (A, C):
                (collection/(identity+'.md')).rename(collection/(identity[7:]+'.md'))
            cli(target, 'sync-index', label=setup+'-sync')
        elif setup == 'body-edit':
            append_body(target, A, 'BENCH_CURRENT_BODY_A')
        elif setup == 'oversize-P':
            file = collection/'archive/261001-record-08001.md'
            with file.open('ab') as output:
                output.write(b'\n'+b'x'*(2*1024*1024+1)+b'\n')
        elif setup == 'candidate-predecessor':
            file = collection/f'{C}.md'
            text = file.read_text().replace('relations: []', f'relations:\n  - type: "修订"\n    target: "{A}"\n    summary: "benchmark predecessor"')
            file.write_text(text)
        elif setup == 'archived-Z':
            file = collection/f'{Z}.md'
            text = file.read_text().replace('status: "active"', 'status: "archived"')
            (collection/'archive'/file.name).write_text(text)
            file.unlink()
            cli(target, 'sync-index', label=setup+'-sync')
        elif setup == 'first-publish':
            for file in collection.rglob('*.md'):
                if 'candidate' not in file.stem:
                    file.unlink()
            (collection/'decision-index.json').unlink()
            git(target, 'add', '-A')
            git(target, 'commit', '-qm', 'Only two candidates, no formal or index')
        elif setup == 'A-unrecorded':
            git(target, 'rm', '--cached', 'docs/decisions/'+A+'.md')
            git(target, 'commit', '-qm', 'HEAD omits selected active record')
        elif setup.startswith('stage-'):
            if setup == 'stage-B-pending-A-edited':
                append_body(target, B, 'BENCH_PENDING_B')
                cli(target, 'sync-index', '--select', B, label=setup+'-B-sync')
                cli(target, 'stage', B, '--scope', 'all', label=setup+'-B-stage')
            if setup == 'stage-A-pending-A-reedited':
                append_body(target, A, 'BENCH_PENDING_A_V1')
                cli(target, 'sync-index', '--select', A, label=setup+'-A1-sync')
                cli(target, 'stage', A, '--scope', 'all', label=setup+'-A1-stage')
            append_body(target, A, 'BENCH_CURRENT_A_V2')
            cli(target, 'sync-index', '--select', A, label=setup+'-A2-sync')
        else:
            raise ValueError('Unknown setup '+setup)
        state = snapshot(target)
        proof = verify_sources(state, require_current=setup not in ('body-edit', 'oversize-P'))
        proof['head'] = state.head
        proof['setup'] = setup
        (target/'fixture-proof.json').write_text(json.dumps(proof, indent=2)+'\n')


def main() -> None:
    os.environ['GIT_CONFIG_GLOBAL'] = '/dev/null'
    os.environ['GIT_CONFIG_SYSTEM'] = '/dev/null'
    small = '--small' in sys.argv
    name = 'small-base' if small else 'base'
    target = DOMAIN/'fixtures'/name
    export_base(target, small)
    if not small:
        prepare_setups(target)
    summary = {'completedAt': datetime.now(timezone.utc).isoformat(), 'source': str(SOURCE), 'sourceHead': SOURCE_HEAD,
               'fixtureRoot': str(target), 'small': small, 'CLI': str(CLI), 'cliSha256': hashlib.sha256(CLI.read_bytes()).hexdigest()}
    (DOMAIN/('small-preparation.json' if small else 'preparation.json')).write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
`````

## `decision/methods/probe-interface.md`

逻辑来源：`decision/methods/probe-interface.md`。

展示输入：3416 字节，SHA-256 `364cd067cd0e71c335f889694402d5a653b4873b9a7dc21ccb31f6af9eff10cf`。

`````markdown
# 一次性probe接口

实际argv：`node --import <BENCH_ROOT>/decision/instrumentation/preload.mjs <frozen-public-cli> ...`

collector environment：`RECORD_BENCH_PROBE_CONFIG=<absolute JSON file>`。JSON对象字段：

- `outputDir`: 已存在、当前sample独占目录。
- `collectionRoot`: 完整绝对集合路径；`indexFile`: 完整索引路径。
- `candidatePaths`: 初态候选绝对路径数组；`new`新对象可预先登记。每次readFile/writeFile完整正文带可识别status时，以此次实际观察更新该路径角色，因此publish同路径由candidate转formal、rename新candidate路径仍能正确分类。未观察状态的partial read按最近已知角色，需注明该边界。
- `resourceRoots`: 资源树绝对路径数组（Decision为空）。
- `gitObjectRoles`: 可选`{head: string[] (OID), pending: string[]}`，来自sample执行前实际HEAD tree/pending manifest；同OID同时归属则明示双角色，不伪造单一来源，未知为unknown。不包括凭前缀估算的payload。
- `hooks`: 可选`{file,sha256,needle,insert}[]`。file精确绝对源路径，sha256是hook前原文UTF8SHA，needle必须唯一，insert加在needle后；不满足即失败。loader保存转换前后SHA和插入位置。域私有probe副本也可直接插入`globalThis.__recordProbeCount(name, amount=1)`；此函数只存在于probe。

每pid/thread输出`probe-<pid>-<thread>.events.jsonl`，逐事件同步追加，以免被终止worker丢尾；它是汇总权威。`start`识别线程；`io`是一次成功完成的逻辑API操作，path/category/direction/method/calls=1/bytes；`count`是name/amount；`git`是子进程close后的argv、真实stdout/stderrbytes、cat-file framing与请求，`end`含unknown、盲区、loader fingerprints。可选最终`probe-*.json`是方便阅读的线程快照，不与events重复相加；无end需报告线程未完成，events仍可恢复已完成操作。只汇总events。

分类：`index`、`candidate`、`resource`、`formal`、`collection-other`、`other`、`unknown`。formal是集合中其余`.md`（不能把index临时锁/JSON当正文）。readFile内部read、writeFile内部write按高层completed operation去重；calls不是kernel syscall次数。零字节读取仍计call，unique按绝对path去重；重命名两路径是两个locator。

`Git cat-file --batch` batch字段含真实blob bytes（每个OID可重复出现）、headerBytes/payloadBytes/trailerBytes；stdoutBytes包含三者。roles按样本初态对象成员映射，可双角色，不能将双方字节简单求和当总量。请求保留IDs，非batch Git命令只计stdoutbytes；未知framing拒绝解析并标unknown，不编0。Git内部文件写/读不在Node FS hook覆盖内，Git pending实际变化由独立post-state oracle核验。

失败高层IO可能已部分读写但没有返回字节数，记unknown；counter统计的是Node可观测成功完成bytes，不宣称完整磁盘I/O或物理cache miss。不会把lock/临时写计为最终领域diff，两者分开。

未hook rename/unlink/mkdir/chmod元操作调用次数：它们不是零，而是本collector未测。实际文件增删/移位/mode变化由独立fixture manifest/Git后验报告。read/write是JS/安全API成功返回量，不是kernel syscall或物理磁盘IO；Node loader/依赖读取可能经不同内部路径，不作为被测数据集工作量结论。
`````

## `decision/methods/run.py`

逻辑来源：`decision/methods/run.py`。

展示输入：10285 字节，SHA-256 `73cd95e1de52274c9e62f50e9c570c141d72f9669b3927dad806b1e7c7ba6ad6`。

`````python
"""Run one-operation samples through the frozen outer collector, then independent posterior."""
from __future__ import annotations

from dataclasses import asdict
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

from oracle import State, snapshot, posterior, verify_sources, git
from outcomes import save_final

DOMAIN = Path(__file__).resolve().parents[1]
ROOT = DOMAIN.parent
CLI = ROOT/'snapshot/skills/decision-records/scripts/decision-records.ts'
COLLECTOR = ROOT/'methods/measure.py'
PRELOAD = DOMAIN/'instrumentation/preload.mjs'
A = '261001-record-09001'


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def input_manifest(state: State) -> dict[str, object]:
    return {'files': dict(state.workspace_files), 'modes': dict(state.workspace_modes), 'pending': dict(state.pending), 'head': state.head}


def write_once(file: Path, value: object) -> None:
    file.parent.mkdir(parents=True, exist_ok=True)
    with file.open('x') as output:
        output.write(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def source_hooks() -> list[dict[str, str]]:
    # Exact frozen-source anchors, not broad regex or AST rewrites.
    specs = [
        ('decision-records/src/decision-metadata.ts', '): ParsedDecisionMarkdown | null {\n', 'decision.parse-markdown', None),
        ('decision-records/src/decision-metadata.ts', '  const frontmatter = parseYamlFrontmatter(\n', 'decision.parse-identity', None),
        ('decision-records/src/decision-index-snapshot.ts', '): StateIndexResult<DecisionIndexSnapshot> {\n  const parsed = parseStateIndex({\n', 'decision.parse-index-snapshot', None),
        ('decision-records/src/decision-state-index.ts', '): StateIndexResult<DecisionIndex> {\n  return snapshotIndex(parseDecisionIndexSnapshot', 'decision.parse-index', None),
        ('decision-records/src/relation-graph.ts', 'function buildDecisionRelationGraph(\n  records: readonly DecisionRelationConsistencyRecord[]\n): DecisionRelationGraph {\n', 'decision.graph-build', 'records.length'),
        ('shared/src/graph/relations.ts', '): RelationGraph<Id, Type> {\n', 'shared.graph-build', None),
        ('index-runtime/src/snapshot-parser.ts', '}): StateIndexResult<StateIndex<State, Metadata>> {\n', 'shared.parse-index', None),
        ('index-runtime/src/snapshot-parser.ts', 'export function parseStateIndexEnvelope(options: {\n  expectation: StateIndexExpectation;\n  sourcePath: string;\n  text: string;\n}): StateIndexResult<StateIndex> {\n', 'shared.parse-index-envelope', None),
        ('shared/src/markdown/frontmatter.ts', 'export function parseYamlFrontmatter(markdown: string): Frontmatter | null {\n', 'shared.parse-frontmatter', None),
    ]
    hooks = []
    for source, needle, name, nodes in specs:
        file = CLI.parent/'runtime/tools'/source
        text = file.read_text()
        # Two anchors contain a following statement: insert must occur before it, not inside.
        if name == 'decision.parse-index-snapshot':
            needle = 'export function parseDecisionIndexSnapshot(\n  text: string,\n  sourcePath: string\n): StateIndexResult<DecisionIndexSnapshot> {\n'
        elif name == 'decision.parse-index':
            needle = 'export function parseDecisionIndex(\n  text: string,\n  sourcePath: string\n): StateIndexResult<DecisionIndex> {\n'
        if text.count(needle) != 1:
            raise ValueError('Nonunique frozen source hook '+source+' '+name)
        insert = f'  globalThis.__recordProbeCount({json.dumps(name)});\n'
        if nodes:
            insert += f'  globalThis.__recordProbeCount("decision.graph-nodes", {nodes});\n'
        # parse-identity's needle is the first line of an expression, so move hook before it.
        if name == 'decision.parse-identity':
            needle = '  isCandidate: boolean;\n}> {\n'
            if text.count(needle) != 1:
                raise ValueError('Nonunique identity source hook')
        hooks.append({'file': str(file), 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'needle': needle, 'insert': insert})
    return hooks


def counter_config(run_root: Path, before: State, output: Path) -> dict[str, object]:
    output.mkdir()
    collection = run_root/'docs/decisions'
    roles = {}
    for role, argv in [('head', ('ls-tree', '-r', '--format=%(objectname)', 'HEAD')), ('pending', ('ls-files', '--stage'))]:
        text = git(run_root, *argv).decode()
        roles[role] = list(dict.fromkeys(text.splitlines() if role == 'head' else [line.split()[1] for line in text.splitlines()]))
    return {'outputDir': str(output), 'collectionRoot': str(collection), 'indexFile': str(collection/'decision-index.json'),
            'candidatePaths': [str(collection/doc.source) for doc in before.documents.values() if doc.metadata['status']=='candidate'],
            'resourceRoots': [], 'gitObjectRoles': roles, 'hooks': source_hooks()}


def read_counter(output: Path) -> dict[str, object]:
    spec = importlib.util.spec_from_file_location('counter_summary', DOMAIN/'instrumentation/summarize.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.summarize(output)


def execute(row: dict[str, object], iteration: int, mode: str, small: bool = False, fixture_override: Path | None = None) -> dict[str, object]:
    setup = DOMAIN/'fixtures'/('small-base' if small else str(row['setup']))
    if fixture_override is not None:
        setup = fixture_override
    run_root = DOMAIN/'run-workspace'
    if run_root.exists():
        shutil.rmtree(run_root)
    shutil.copytree(setup, run_root, copy_function=shutil.copy2)
    before = snapshot(run_root)
    manifest = input_manifest(before)
    digest = hashlib.sha256(canonical(manifest)).hexdigest()
    input_file = DOMAIN/'inputs'/(('small-'+str(row['setup'])+'-v3.json') if small else str(row['setup'])+'-v3.json')
    if input_file.exists():
        assert json.loads(input_file.read_text()) == json.loads(canonical(manifest)), 'Prepared setup drift'
    else:
        write_once(input_file, manifest)
    prefix = DOMAIN/'raw'/mode/f'{iteration:02d}-{row["id"]}'
    argv = ['node']
    environment = {}
    if mode == 'instrumented':
        counter_output = DOMAIN/'counters'/f'{iteration:02d}-{row["id"]}'
        config = counter_config(run_root, before, counter_output)
        config_file = counter_output/'config.json'
        write_once(config_file, config)
        environment['RECORD_BENCH_PROBE_CONFIG'] = str(config_file)
        argv.extend(['--import', str(PRELOAD)])
    argv.extend([str(CLI), '--root', str(run_root), *row['argv']])
    spec = {'argv': argv, 'cwd': str(run_root), 'outputPrefix': str(prefix), 'timeoutSeconds': 600,
            'domain': 'decision', 'scenario': row['id'], 'iteration': iteration, 'mode': mode,
            'environment': environment}
    spec_file = prefix.with_suffix('.spec.json')
    write_once(spec_file, spec)
    result = subprocess.run(['python3', str(COLLECTOR), str(spec_file)], capture_output=True)
    if result.returncode:
        raise RuntimeError('Outer collector failed: '+result.stderr.decode())
    metrics = json.loads(prefix.with_suffix('.metrics.json').read_text())
    after = snapshot(run_root)
    stdout = prefix.with_suffix('.stdout').read_text()
    stderr = prefix.with_suffix('.stderr').read_text()
    write_once(prefix.with_suffix('.input.json'), {'setupManifest': str(input_file), 'inputSha256': digest, 'normalization': 'same run-workspace path for every sample'})
    try:
        save_final(prefix, run_root, row, before, after)
        if metrics.get('outcome') != 'exited':
            raise ValueError('Non-exited collector outcome: '+str(metrics.get('outcome')))
        exit_code = metrics.get('exitCode')
        proof = posterior(run_root, row, before, after, exit_code, stdout, stderr)
        if mode == 'instrumented':
            counter = read_counter(counter_output)
            write_once(counter_output/'summary.json', counter)
            infrastructure_unknown = [item for item in counter['unknown'] if item.get('reason') != 'failed-operation-partial-bytes-unknown']
            if infrastructure_unknown:
                raise ValueError('Counter infrastructure failure: '+str(infrastructure_unknown))
        write_once(prefix.with_suffix('.posterior.json'), proof)
    except Exception as error:
        write_once(prefix.with_suffix('.posterior-failure.json'), {'scenario': row['id'], 'error': repr(error), 'metrics': metrics,
                   'before': digest, 'after': input_manifest(after)})
        raise
    return {'scenario': row['id'], 'iteration': iteration, 'mode': mode, 'metrics': str(prefix.with_suffix('.metrics.json')),
            'posterior': str(prefix.with_suffix('.posterior.json')), 'inputSha256': digest}


def main() -> None:
    os.environ['GIT_CONFIG_GLOBAL'] = '/dev/null'
    os.environ['GIT_CONFIG_SYSTEM'] = '/dev/null'
    rows = json.loads((DOMAIN/'matrix.json').read_text())['scenarios']
    if '--smoke' in sys.argv:
        for key in ('list', 'show', 'check', 'set-relations', 'publish-independent'):
            row = next(row for row in rows if row['id'] == key)
            print(json.dumps(execute(row, 0, 'smoke', small=True)), flush=True)
        return
    if '--probe-smoke' in sys.argv:
        row = next(row for row in rows if row['id'] == 'list-relations')
        print(json.dumps(execute(row, 0, 'instrumented', small=True)), flush=True)
        return
    mode = sys.argv[1]
    iteration = int(sys.argv[2])
    if mode not in ('normal', 'instrumented') or iteration not in (1, 2, 3):
        raise ValueError('Require normal/instrumented and round1..3')
    ordered = list(reversed(rows)) if mode == 'normal' and iteration == 2 else rows
    order = {'mode': mode, 'iteration': iteration, 'scenarios': [row['id'] for row in ordered], 'startedAt': datetime.now(timezone.utc).isoformat()}
    write_once(DOMAIN/'orders'/f'{mode}-{iteration}.json', order)
    for row in ordered:
        print(json.dumps(execute(row, iteration, mode)), flush=True)


if __name__ == '__main__':
    main()
`````

## `decision/methods/summarize-results.py`

逻辑来源：`decision/methods/summarize-results.py`。

展示输入：8763 字节，SHA-256 `8baa87ecd30b62ad1f718791d7af2e63578b88ccbe040f5da3f1f3725ced8623`。

`````python
"""Post-process frozen measurements; never executes or modifies a measured fixture."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import statistics
import sys
from typing import Mapping

DOMAIN = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DOMAIN/'methods'))
from outcomes import compare_domain

FIELDS = ('wallSeconds', 'userSeconds', 'systemSeconds', 'cpuSeconds', 'maxRssKiB')
DATA_CATEGORIES = {'formal', 'candidate', 'index', 'resource', 'collection-other'}


def distribution(samples: list[Mapping[str, object]], field: str) -> dict[str, float | int]:
    values = [sample[field] for sample in samples]
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) for value in values):
        raise ValueError('Incomplete numeric sample '+field)
    return {'min': min(values), 'median': statistics.median(values), 'max': max(values)}


def group(row: Mapping[str, object]) -> str:
    key = row['id']
    command = row['argv'][0]
    if row['formalCount'] == 0:
        return '0正式边界（不属于1万负载）'
    if command == 'stage':
        return 'Git pending / '+row['argv'][-1]
    if command == 'sync-index':
        return '同步 / '+('selected' if '--select' in row['argv'] else 'full')
    if command == 'rename':
        return '身份更正 / '+('no-op' if key.endswith('-noop') else '实际或预检')
    if command in ('publish', 'evolve'):
        return '建立与演进 / '+('含discard' if '--discard' in row['argv'] else '不含discard')
    if command == 'discard':
        return '严格删除'
    if command in ('new', 'candidates', 'show-candidate'):
        return '候选入口'
    if command in ('list', 'search', 'show', 'trace'):
        return '普通查询 / '+('图依赖' if '--related-to' in row['argv'] or command == 'trace' else '无关系图条件')
    if command == 'check':
        return '严格全集检查'
    return '正式局部维护'


def observed_file_writes(counter: Mapping[str, object]) -> dict[str, object]:
    observations = []
    standard_streams = {'unknown-fd:0', 'unknown-fd:1', 'unknown-fd:2', 'stdio:stdin', 'stdio:stdout', 'stdio:stderr'}
    for thread in counter['threads']:
        with Path(thread['events']).open() as events:
            for line in events:
                event = json.loads(line)
                if event['type'] != 'io':
                    continue
                value = event['value']
                if value['direction'] == 'write' and value['path'] not in standard_streams:
                    observations.append(value)
    return {'calls': sum(value['calls'] for value in observations),
            'bytes': sum(value['bytes'] for value in observations),
            'uniquePaths': len({value['path'] for value in observations}),
            'observations': observations,
            'boundary': 'Node completed API writes, including observed temporary paths outside collection; stdout/stderr descriptors excluded. Not Git-native filesystem writes.'}


def summarize() -> dict[str, object]:
    rows = json.loads((DOMAIN/'matrix.json').read_text())['scenarios']
    equivalence = compare_domain(DOMAIN)
    with (DOMAIN/'equivalence.json').open('x') as output:
        output.write(json.dumps(equivalence, ensure_ascii=False, indent=2)+'\n')
    result = []
    for row in rows:
        key = row['id']
        metrics = []
        proofs = []
        for iteration in (1, 2, 3):
            prefix = DOMAIN/'raw/normal'/f'{iteration:02d}-{key}'
            sample = json.loads(prefix.with_suffix('.metrics.json').read_text())
            proof = json.loads(prefix.with_suffix('.posterior.json').read_text())
            if sample['outcome'] != 'exited' or sample['exitCode'] != row['exit'] or not proof['passed']:
                raise ValueError('Unaccepted formal sample '+str(prefix))
            metrics.append(sample)
            proofs.append(proof)
        counter_file = DOMAIN/'counters'/f'01-{key}'/'summary.json'
        counter = json.loads(counter_file.read_text())
        scope_io = [entry for entry in counter['io'] if entry['category'] in DATA_CATEGORIES]
        result.append({
            'scenario': key,
            'group': group(row),
            'formalCount': row['formalCount'],
            'argv': row['argv'],
            'expectedExit': row['exit'],
            'status': 'expected-refusal' if row['exit'] else 'success',
            'normal': {field: distribution(metrics, field) for field in FIELDS},
            'normalMetrics': [str(DOMAIN/'raw/normal'/f'{iteration:02d}-{key}.metrics.json') for iteration in (1, 2, 3)],
            'probeWorkload': {
                'io': [{name: value for name, value in entry.items() if name != 'paths'} for entry in scope_io],
                'allIoByCategory': [{name: value for name, value in entry.items() if name != 'paths'} for entry in counter['io']],
                'observedFileWrites': observed_file_writes(counter),
                'parseGraphCounts': counter['counts'],
                'gitBatchCount': counter['gitBatchCount'],
                'gitActualPayloadBytes': counter['gitActualPayloadBytes'],
                'gitStdoutBytes': counter['gitStdoutBytes'],
                'threadCount': len(counter['threads']),
                'unknown': counter['unknown'],
                'fullEvidence': str(counter_file),
            },
            'actualState': proofs[0],
            'equivalencePassed': True,
        })
    return {'schemaVersion': 1, 'sourceHEAD': '70c1a255', 'scenarioCount': len(result), 'normalSampleCount': len(result)*3,
            'probeSampleCount': len(result), 'equivalence': str(DOMAIN/'equivalence.json'), 'rows': result,
            'boundaries': ['Only normal three samples enter timing distributions; instrumented times are not substituted.',
                           'CPU is user+system in wait4 collector; maxRSS is process/waited-child high-water mark, not simultaneous tree memory sum.',
                           'JS/API completed byte counts are not kernel syscalls or physical disk IO; expected failed IO can retain partial-byte unknowns.',
                           'Git role labels may overlap for shared OIDs; actual total batch payload does not double-count memberships.',
                           'Copy/hash/posterior happen outside timings and warm OS caches; three samples are descriptive, not statistical significance.']}


def markdown(summary: Mapping[str, object]) -> str:
    lines = ['# Decision Records 当前版本全入口测量', '',
             '63场景覆盖18命令；每场景3个正常样本+1个独立工作量probe。0正式边界单列，拒绝不计为成功操作。', '',
             '下表按责任契约分组，不将所有入口混为排名；完整min/median/max、CPU分量、RSS和原始证据见summary.json。', '']
    groups = sorted({row['group'] for row in summary['rows']})
    for owner in groups:
        lines.extend(['## '+owner, '', '| 场景 | wall ms min/med/max | CPU ms med | RSS MiB med | 正式read calls/unique | Git batches/payload MiB | 文件write calls/bytes（含临时） |', '|---|---:|---:|---:|---:|---:|---:|'])
        for row in summary['rows']:
            if row['group'] != owner:
                continue
            wall = row['normal']['wallSeconds']
            workload = row['probeWorkload']
            formal = next((item for item in workload['io'] if item['category'] == 'formal' and item['direction'] == 'read'), None)
            formal_text = str(formal['calls'])+'/'+str(formal['uniqueFiles']) if formal else '0/0'
            writes = workload['observedFileWrites']
            payload = workload['gitActualPayloadBytes']
            git_text = f'{workload["gitBatchCount"]}/'+(f'{payload/1048576:.3f}' if payload is not None else 'unknown')
            label = row['scenario']+('（预期拒绝）' if row['expectedExit'] else '')
            lines.append(f'| {label} | {wall["min"]*1000:.1f}/{wall["median"]*1000:.1f}/{wall["max"]*1000:.1f} | {row["normal"]["cpuSeconds"]["median"]*1000:.1f} | {row["normal"]["maxRssKiB"]["median"]/1024:.1f} | {formal_text} | {git_text} | {writes["calls"]}/{writes["bytes"]} |')
        lines.append('')
    lines.extend(['## 可测边界', '']+['- '+boundary for boundary in summary['boundaries']])
    return '\n'.join(lines)+'\n'


if __name__ == '__main__':
    result = summarize()
    with (DOMAIN/'summary.json').open('x') as output:
        output.write(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    with (DOMAIN/'summary.md').open('x') as output:
        output.write(markdown(result))
    print(json.dumps({'summary': str(DOMAIN/'summary.json'), 'scenarios': result['scenarioCount']}))
`````

## `investigation/methods/fixture.py`

逻辑来源：`investigation/methods/fixture.py`。

展示输入：3829 字节，SHA-256 `6eb78868d0c56f0a5c7b590f83c38b828d1d4a0f3068034c887d8d47d12ca493`。

`````python
"""Create and freeze private synthetic Git fixtures from a fixed read-only input."""
from __future__ import annotations
import json
import os
from pathlib import Path
import shutil
import subprocess
from oracle import verify_index, worktree_manifest, pending_manifest
ROOT = Path(__file__).resolve().parents[1]
FROZEN = ROOT.parent / 'snapshot/skills/investigation-report/scripts/check-investigations.ts'
ORIGINAL = Path('<FIXTURE_SOURCE>')
FIXED = '9fdb438d'
COLLECTION = 'docs/investigations'
ENV = {key: value for key, value in os.environ.items() if not key.startswith('GIT_') and key not in {'NODE_OPTIONS', 'NODE_PATH'}}
ENV.update({'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_SYSTEM': '/dev/null', 'GIT_CONFIG_NOSYSTEM': '1', 'TZ': 'UTC', 'GIT_AUTHOR_DATE': '2026-10-01T00:00:00Z', 'GIT_COMMITTER_DATE': '2026-10-01T00:00:00Z'})

def run(argv: list[str], cwd: Path, output: Path) -> None:
    result = subprocess.run(argv, cwd=cwd, env=ENV, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.with_suffix('.stdout').write_bytes(result.stdout)
    output.with_suffix('.stderr').write_bytes(result.stderr)
    output.with_suffix('.json').write_text(json.dumps({'argv': argv, 'cwd': str(cwd), 'exitCode': result.returncode}, ensure_ascii=False, indent=2) + '\n')
    if result.returncode:
        raise RuntimeError(f'fixture preparation failed: {argv!r}; {result.stderr.decode()}')

def init_git(target: Path) -> None:
    subprocess.run(['git', 'init', '--quiet', str(target)], env=ENV, check=True)
    for key, value in [('core.hooksPath', '/dev/null'), ('user.name', 'Record Benchmark Fixture'), ('user.email', 'fixture@example.invalid')]:
        subprocess.run(['git', '-C', str(target), 'config', key, value], env=ENV, check=True)
    if subprocess.check_output(['git', '-C', str(target), 'remote'], env=ENV):
        raise RuntimeError('fixture has remote')

def freeze(target: Path, label: str) -> None:
    if not target.resolve().is_relative_to(ROOT):
        raise ValueError('not owned fixture')
    run(['git', 'add', '--all'], target, ROOT / 'preparation-logs' / f'{label}-add')
    run(['git', 'commit', '--quiet', '-m', f'freeze synthetic fixture {label}'], target, ROOT / 'preparation-logs' / f'{label}-commit')
    manifest = {'worktree': worktree_manifest(target), 'pending': pending_manifest(target)}
    (target.parent / f'{target.name}.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True) + '\n')

def build_smoke() -> Path:
    target = ROOT / 'smoke-20'
    if target.exists():
        raise FileExistsError(target)
    directory = target / COLLECTION
    directory.mkdir(parents=True)
    for n in range(1, 21):
        name = f'261001-record-{n:05d}.md'
        data = subprocess.check_output(['git', '-C', str(ORIGINAL), 'show', f'{FIXED}:{COLLECTION}/{name}'], env=ENV)
        (directory / name).write_bytes(data)
    for n in (1, 2):
        name = f'_candidate.261001-candidate-{n}'
        (directory / name).write_bytes(subprocess.check_output(['git', '-C', str(ORIGINAL), 'show', f'{FIXED}:{COLLECTION}/{name}'], env=ENV))
    resource = directory / '_resources/261001-record-00001/evidence.txt'
    resource.parent.mkdir(parents=True)
    resource.write_bytes(subprocess.check_output(['git', '-C', str(ORIGINAL), 'show', f'{FIXED}:{COLLECTION}/_resources/261001-record-00001/evidence.txt'], env=ENV))
    init_git(target)
    run(['node', str(FROZEN), '--root', str(target), 'sync-index'], target, ROOT / 'preparation-logs/smoke-sync')
    records = verify_index(directory)
    if len(records) != 20:
        raise AssertionError('smoke fixture size')
    freeze(target, 'smoke20')
    return target
if __name__ == '__main__':
    print(build_smoke())
`````

## `investigation/methods/instrument.py`

逻辑来源：`investigation/methods/instrument.py`。

展示输入：5172 字节，SHA-256 `ceb530bb6559a8aa3bb840b576432a8cb90d5478448edb56a5e009168753ad8f`。

`````python
"""Copy frozen IR distribution and install measurement-only domain source hooks."""
from __future__ import annotations
import difflib
import hashlib
import json
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'snapshot/skills/investigation-report'
TARGET = ROOT / 'instrumented-skill-v3'

def install() -> None:
    if TARGET.exists():
        raise FileExistsError(TARGET)
    shutil.copytree(SOURCE, TARGET)
    (TARGET / 'node_modules').symlink_to(ROOT.parent / 'snapshot/node_modules', target_is_directory=True)
    runtime = TARGET / 'scripts/runtime/tools/investigation-report/src'
    helper = runtime / 'measurement-domain-counter.ts'
    helper.write_text('type Counter = (name: string, amount?: number) => void;\nexport function probeCount(name: string, amount = 1): void {\n  const candidate: unknown = Reflect.get(globalThis, "__recordProbeCount");\n  if (typeof candidate !== "function") throw new Error("IR measurement counter unavailable");\n  const count = candidate as Counter;\n  count("investigation." + name, amount);\n}\n')
    hooks = [('markdown.ts', '  options: InvestigationReportParseOptions = {}\n): ParsedInvestigationReport {', 'reportParse'), ('markdown-frontmatter.ts', '): ParsedInvestigationFrontmatter | null {', 'frontmatterParse'), ('investigation-layout.ts', '): Promise<InvestigationCollectionLayout> {', 'layout'), ('relation-context.ts', '): InvestigationRelationContext {', 'relationContext')]
    manifest: list[dict[str, object]] = []
    patches: list[str] = []

    def patch_file(filename: str, needle: str, insertion: str) -> None:
        file = runtime / filename
        before = file.read_text()
        if before.count(needle) != 1:
            raise ValueError(f'expected one hook needle in {filename}: {needle}')
        after = 'import { probeCount } from "./measurement-domain-counter.ts";\n' + before.replace(needle, needle + insertion, 1) if 'measurement-domain-counter.ts' not in before else before.replace(needle, needle + insertion, 1)
        file.write_text(after)
        manifest.append({'file': str(file), 'needle': needle, 'insertion': insertion, 'beforeSha256': hashlib.sha256(before.encode()).hexdigest(), 'afterSha256': hashlib.sha256(after.encode()).hexdigest()})
        patches.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile=filename, tofile=filename))
    for filename, needle, name in hooks:
        patch_file(filename, needle, f'\n  probeCount("{name}");')
    patch_file('relation-context.ts', 'graph: createLazyRelationGraph(() => {', '\n      probeCount("graphBuild");\n      probeCount("graphVertices", entries.length);\n      probeCount("graphEdges", entries.reduce((sum, entry) => sum + entry.state.relations.length, 0));')
    validation = runtime / 'relation-validation.ts'
    text = validation.read_text()
    import re
    match = re.search('export function validateInvestigationRelationGraph\\([\\s\\S]*?\\): string\\[\\] \\{', text)
    if match is None:
        raise ValueError('graph validator hook signature missing')
    patch_file('relation-validation.ts', match.group(), '\n  probeCount("graphValidation");')
    file = runtime / 'validation-history.ts'
    before = file.read_text()
    needle = '    const prefixes = await readRevisionFilePrefixes(repository, {'
    after = 'import { probeCount } from "./measurement-domain-counter.ts";\n' + before.replace(needle, '    probeCount("historyFormalRequested", sourcePaths.length);\n' + needle, 1)
    file.write_text(after)
    patches.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile='validation-history.ts', tofile='validation-history.ts'))
    manifest.append({'file': str(file), 'beforeSha256': hashlib.sha256(before.encode()).hexdigest(), 'afterSha256': hashlib.sha256(after.encode()).hexdigest(), 'insertion': 'historyFormalRequested before readRevisionFilePrefixes'})
    file = TARGET / 'scripts/runtime/tools/index-runtime/src/snapshot-parser.ts'
    before = file.read_text()
    needle = '    value = JSON.parse(options.text);'
    if before.count(needle) != 1:
        raise ValueError('index JSON hook needle is not unique')
    after = 'import { probeCount } from "../../investigation-report/src/measurement-domain-counter.ts";\n' + before.replace(needle, '    probeCount("indexJsonParse");\n    probeCount("indexJsonParseBytes", Buffer.byteLength(options.text));\n' + needle, 1)
    file.write_text(after)
    patches.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile='index-runtime/snapshot-parser.ts', tofile='index-runtime/snapshot-parser.ts'))
    manifest.append({'file': str(file), 'needle': needle, 'beforeSha256': hashlib.sha256(before.encode()).hexdigest(), 'afterSha256': hashlib.sha256(after.encode()).hexdigest(), 'insertion': 'indexJsonParse and indexJsonParseBytes immediately before actual JSON.parse'})
    (ROOT / 'instrumentation-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'instrumentation.patch').write_text(''.join(patches))
if __name__ == '__main__':
    install()
`````

## `investigation/methods/oracle.py`

逻辑来源：`investigation/methods/oracle.py`。

展示输入：6594 字节，SHA-256 `e2f8b8a39f8e36b8e91c5c649f1dd4d2606f7eac2a1296c5309b352ef042a8be`。

`````python
"""Independent fixture-subset parser and filesystem/pending posterior capture."""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import subprocess
from typing import Mapping

@dataclass(frozen=True)
class Record:
    id: str
    title: str
    formed_at: str
    question: str
    tags: tuple[str, ...]
    relations: tuple[tuple[str, str, str | None], ...]
    resources: tuple[str, ...]
    path: str

def parse_record(file: Path, directory: Path) -> Record:
    text = file.read_text()
    lines = text.splitlines()
    if not lines or lines[0] != '---':
        raise ValueError(f'missing header {file}')
    end = lines.index('---', 1)
    fields: dict[str, str] = {}
    tags: list[str] = []
    relations: list[dict[str, str]] = []
    mode = 'fields'
    for line in lines[1:end]:
        if line in {'tags:', 'relations:', 'relations: []'}:
            mode = 'tags' if line == 'tags:' else 'relations'
            continue
        scalar = re.fullmatch('(title|id|formedAt|question): (".*")', line)
        if scalar:
            fields[scalar[1]] = json.loads(scalar[2])
            continue
        tag = re.fullmatch('  - (".*")', line)
        if mode == 'tags' and tag:
            tags.append(json.loads(tag[1]))
            continue
        relation = re.fullmatch('  - type: (".*")', line)
        if mode == 'relations' and relation:
            relations.append({'type': json.loads(relation[1])})
            continue
        child = re.fullmatch('    (target|summary): (".*")', line)
        if mode == 'relations' and child and relations:
            relations[-1][child[1]] = json.loads(child[2])
            continue
        raise ValueError(f'unknown fixed fixture syntax {file}: {line!r}')
    if set(fields) != {'id', 'title', 'formedAt', 'question'} or not tags:
        raise ValueError(f'bad fixture fields {file}')
    resources = tuple(sorted(set(re.findall('\\]\\(\\./_resources/([^\\s)]+)\\)', text))))
    return Record(fields['id'], fields['title'], fields['formedAt'], fields['question'], tuple(tags), tuple(((x['type'], x['target'], x.get('summary')) for x in relations)), resources, file.relative_to(directory).as_posix())

def source_fingerprint(record: Record, directory: Path) -> str:
    h = hashlib.sha256(b'investigation-index-entry-v2\x00')
    for field in (record.id, record.path, (directory / record.path).read_text().replace('\r\n', '\n').replace('\r', '\n')):
        data = field.encode()
        h.update(str(len(data)).encode() + b':' + data + b'\x00')
    return 'sha256:' + h.hexdigest()

def verify_index(directory: Path) -> dict[str, Record]:
    records = {r.id: r for f in directory.glob('*.md') if (r := parse_record(f, directory))}
    index = json.loads((directory / 'investigation-index.json').read_text())
    if set(index['entries']) != set(records):
        raise AssertionError('index formal identities differ')
    for ident, r in records.items():
        value = index['entries'][ident]
        expected = {'formedAt': r.formed_at, 'name': re.sub('^\\d{6}-', '', ident), 'question': r.question, 'relations': [{'type': kind, 'target': target, **({'summary': summary} if summary is not None else {})} for kind, target, summary in r.relations], 'resourceIds': list(r.resources), 'sourcePath': r.path, 'tags': list(r.tags), 'title': r.title}
        if value != expected:
            raise AssertionError(f'index metadata differs {ident}: {value!r} vs {expected!r}')
        if index['sourceRevision']['entries'][ident] != source_fingerprint(r, directory):
            raise AssertionError(f'source fingerprint differs {ident}')
        for _, target, _ in r.relations:
            if target not in records:
                raise AssertionError(f'dangling relation {ident} -> {target}')
        for resource in r.resources:
            if not (directory / '_resources' / resource).is_file():
                raise AssertionError(f'missing resource {resource}')
    return records

def worktree_manifest(root: Path) -> dict[str, dict[str, object]]:
    out: dict[str, dict[str, object]] = {}
    for file in sorted(root.rglob('*')):
        if '.git' in file.relative_to(root).parts:
            continue
        if file.is_symlink():
            raise ValueError(f'unexpected product symlink {file}')
        if file.is_file():
            data = file.read_bytes()
            out[file.relative_to(root).as_posix()] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'mode': file.stat().st_mode & 511}
    return out

def git(root: Path, *args: str, data: bytes | None=None) -> bytes:
    run = subprocess.run(['git', '-C', str(root), *args], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if run.returncode:
        raise RuntimeError(f'git {args!r}: {run.stderr.decode()}')
    return run.stdout

def pending_manifest(root: Path) -> dict[str, dict[str, object]]:
    raw = git(root, 'ls-files', '--stage', '-z')
    out: dict[str, dict[str, object]] = {}
    entries: list[tuple[str, str, str]] = []
    for item in raw.split(b'\x00'):
        if not item:
            continue
        meta, name = item.split(b'\t', 1)
        mode, oid, stage = meta.decode().split()
        if stage != '0':
            raise ValueError('fixture has unmerged pending entries')
        entries.append((name.decode(), mode, oid))
    ids = sorted({oid for _, _, oid in entries})
    payload = git(root, 'cat-file', '--batch', data=('\n'.join(ids) + '\n').encode()) if ids else b''
    objects: dict[str, dict[str, object]] = {}
    offset = 0
    for oid in ids:
        end = payload.index(b'\n', offset)
        header = payload[offset:end].decode().split()
        if len(header) != 3 or header[:2] != [oid, 'blob']:
            raise ValueError('invalid independent Git batch header')
        size = int(header[2])
        data = payload[end + 1:end + 1 + size]
        offset = end + size + 2
        if len(data) != size or payload[offset - 1:offset] != b'\n':
            raise ValueError('truncated independent Git batch')
        objects[oid] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': size}
    if offset != len(payload):
        raise ValueError('excess independent Git batch')
    for name, mode, oid in entries:
        out[name] = {'objectId': oid, 'mode': mode, **objects[oid]}
    return out

def manifest_delta(before: Mapping[str, object], after: Mapping[str, object]) -> list[str]:
    return sorted((key for key in set(before) | set(after) if before.get(key) != after.get(key)))
`````

## `investigation/methods/posterior.py`

逻辑来源：`investigation/methods/posterior.py`。

展示输入：3600 字节，SHA-256 `45ed2c6a295e342a4088e175a92ab83562b4c2073046923d60580b19c0b3ab20`。

`````python
"""Dispatch complete command-group posteriors without invoking product check."""
from __future__ import annotations
from pathlib import Path
from oracle import manifest_delta
from prepare import A
from posterior_state import Captured, capture, equal, protect_index_envelope
from posterior_mutation import check_new, check_publish, check_sync, check_relations, check_rename, check_discard
from posterior_query import check_candidates, check_check, check_list, check_search, check_trace
from posterior_stage import check_stage

def readonly_scenario(name: str) -> bool:
    query_prefixes = ('candidates-', 'show-candidate-', 'check-', 'list-', 'show-', 'metadata-', 'content-', 'trace-')
    return name.startswith(query_prefixes) or 'preflight' in name or name.endswith(('-current', '-unchanged', '-noop'))

def dispatch(root: Path, row: dict[str, object], before: Captured, after: Captured, stdout: str, stderr: str) -> None:
    name = str(row['id'])
    if name.startswith('new-'):
        check_new(before, after, stdout)
    elif name.startswith(('candidates-', 'show-candidate-')):
        check_candidates(name, before, stdout)
    elif name.startswith('publish-'):
        check_publish(root, before, after, stdout, 'preflight' in name)
    elif name.startswith('check-'):
        check_check(name, stdout)
    elif name.startswith('sync-'):
        if name.endswith('-changed'):
            check_sync(root, before, after)
    elif name.startswith('list-'):
        check_list(name, before, stdout)
    elif name == 'show-one':
        equal(stdout, before.sources[A].decode(), 'show complete source bytes')
    elif name.startswith(('metadata-', 'content-')):
        check_search(name, before, stdout, stderr)
    elif name.startswith('trace-'):
        check_trace(name, before, stdout)
    elif name == 'relations-changed':
        check_relations(root, before, after)
    elif name.startswith('relations-'):
        return
    elif name.startswith('rename-'):
        if not readonly_scenario(name):
            check_rename(root, name, before, after)
    elif name.startswith('discard-'):
        check_discard(root, name, before, after)
    elif name.startswith('stage-'):
        argv = row['argv']
        if not isinstance(argv, list) or not isinstance(argv[-1], str):
            raise ValueError('stage matrix argv invalid')
        check_stage(root, name, argv[-1], before, after, stdout)
    else:
        raise ValueError('unhandled posterior scenario ' + name)

def check(root: Path, row: dict[str, object], before: Captured, stdout: str, stderr: str, exit_code: int) -> dict[str, object]:
    name = str(row['id'])
    after = capture(root)
    equal(exit_code, row['expectedExit'], 'unexpected CLI exit')
    protect_index_envelope(before, after)
    if readonly_scenario(name):
        equal(after.worktree, before.worktree, 'read-only/preflight/noop worktree differs')
        equal(after.pending, before.pending, 'read-only/preflight/noop pending differs')
    if not name.startswith('stage-'):
        equal(after.pending, before.pending, 'non-stage command changed pending')
    dispatch(root, row, before, after, stdout, stderr)
    return {'passed': True, 'scenario': name, 'worktreeDelta': manifest_delta(before.worktree, after.worktree), 'pendingDelta': manifest_delta(before.pending, after.pending), 'formalCount': sum((not value.path.startswith('_candidate.') for value in after.records.values())), 'candidateCount': sum((value.path.startswith('_candidate.') for value in after.records.values())), 'afterWorktree': after.worktree, 'afterPending': after.pending}
`````

## `investigation/methods/posterior_mutation.py`

逻辑来源：`investigation/methods/posterior_mutation.py`。

展示输入：5731 字节，SHA-256 `a3d67485eb5373ea802bdee7d2ecc8c27317c2f87ee4554a017891679f911ed9`。

`````python
"""Exact write-set and whole-source assertions for non-stage mutations."""
from __future__ import annotations
from dataclasses import replace
from pathlib import Path
from fixture import COLLECTION
from oracle import verify_index
from prepare import A, B, C, D
from posterior_state import Captured, INDEX, equal, exact_worktree_delta, source_path, relation_bytes, required_index

def check_new(before: Captured, after: Captured, stdout: str) -> None:
    ident = '261001-fresh'
    equal(set(after.records) - set(before.records), {ident}, 'new identity')
    equal(set(before.records) - set(after.records), set(), 'new removed existing identity')
    exact_worktree_delta(before, after, {source_path(after, ident)})
    value = after.records[ident]
    equal((value.title, value.question, value.tags, value.relations), ('benchmark fresh', '固定问题', ('benchmark',), ()), 'new metadata')
    equal({key: value for key, value in after.records.items() if key != ident}, before.records, 'new changed existing record')
    if not all((value in stdout for value in ('scaffoldValid: true', 'bodyReady: false', 'resourceReady: true'))):
        raise AssertionError('new readiness output')

def check_publish(root: Path, before: Captured, after: Captured, stdout: str, preflight: bool) -> None:
    phase = 'preflight' if preflight else 'committed'
    if 'relation review (' + phase + '):' not in stdout:
        raise AssertionError('publish relation review phase absent')
    if preflight:
        return
    exact_worktree_delta(before, after, {source_path(before, C), source_path(after, C), INDEX})
    equal(set(after.records), set(before.records), 'publish identity set')
    equal(after.sources[C], before.sources[C], 'published whole source differs')
    equal({key: value for key, value in after.records.items() if key != C}, {key: value for key, value in before.records.items() if key != C}, 'publish changed unselected record')
    if not after.records[C].path.endswith('.md') or after.records[C].path.startswith('_candidate.'):
        raise AssertionError('publish did not establish formal path')
    verify_index(root / COLLECTION)

def check_sync(root: Path, before: Captured, after: Captured) -> None:
    exact_worktree_delta(before, after, {INDEX})
    verify_index(root / COLLECTION)
    equal(after.records, before.records, 'sync rewrote sources')
    old = required_index(before)
    new = required_index(after)
    for ident, value in old.entries.items():
        if ident != A:
            equal(new.entries[ident], value, 'sync changed unselected index metadata')
            equal(new.revisions[ident], old.revisions[ident], 'sync changed unselected revision')

def check_relations(root: Path, before: Captured, after: Captured) -> None:
    exact_worktree_delta(before, after, {INDEX, source_path(before, A)})
    expected = (('复查', '261001-record-00002', 'benchmark review'),)
    equal(after.sources[A], relation_bytes(before.sources[A], expected), 'relations changed body or non-relation header')
    equal(after.records[A], replace(before.records[A], relations=expected), 'relations source model')
    verify_index(root / COLLECTION)

def selected_identity(name: str) -> tuple[str, str, bool]:
    kind = 'candidate' if '-candidate-' in name else 'formal'
    owner = '-owner' in name and '-no-owner' not in name
    source = (D if owner else C) if kind == 'candidate' else B if owner else A
    return (kind, source, owner)

def check_discard(root: Path, name: str, before: Captured, after: Captured) -> None:
    kind, source, owner = selected_identity(name)
    allowed = {source_path(before, source)}
    if kind == 'formal':
        allowed.add(INDEX)
    if owner:
        allowed.update((key for key in before.worktree if key.startswith(COLLECTION + '/_resources/' + source + '/')))
    exact_worktree_delta(before, after, allowed)
    equal(after.records, {key: value for key, value in before.records.items() if key != source}, 'discard modified surviving record')
    if kind == 'formal':
        verify_index(root / COLLECTION)
    else:
        equal(after.index, before.index, 'candidate discard changed index')

def check_rename(root: Path, name: str, before: Captured, after: Captured) -> None:
    kind, source, owner = selected_identity(name)
    target = '261001-renamed-' + kind
    equal(set(after.records), set(before.records) - {source} | {target}, 'rename identity set')
    allowed = {source_path(before, source), source_path(after, target)}
    if kind == 'formal':
        allowed.add(INDEX)
    if owner:
        prefix = COLLECTION + '/_resources/' + source + '/'
        target_prefix = COLLECTION + '/_resources/' + target + '/'
        for key, value in before.worktree.items():
            if key.startswith(prefix):
                newkey = key.replace(prefix, target_prefix, 1)
                equal(after.worktree.get(newkey), value, 'rename resource byte/mode preservation')
                allowed.update((key, newkey))
    exact_worktree_delta(before, after, allowed)
    expected = before.sources[source].replace(('id: "' + source + '"').encode(), ('id: "' + target + '"').encode(), 1)
    expected = expected.replace(('./_resources/' + source + '/').encode(), ('./_resources/' + target + '/').encode())
    equal(after.sources[target], expected, 'rename changed whole source beyond identity/resource-prefix replacements')
    equal({key: value for key, value in after.records.items() if key != target}, {key: value for key, value in before.records.items() if key != source}, 'rename changed unrelated record')
    if kind == 'formal':
        verify_index(root / COLLECTION)
    else:
        equal(after.index, before.index, 'candidate rename changed index')
`````

## `investigation/methods/posterior_query.py`

逻辑来源：`investigation/methods/posterior_query.py`。

展示输入：3976 字节，SHA-256 `863c85898d50bdbab060837164acee34c0adf8e304945f1e24b3a30f69295238`。

`````python
"""Independent ordered query observations from the fixed fixture model."""
from __future__ import annotations
import json
import re
from posterior_state import Captured, equal, required_index
from prepare import A, C, D, U, V

def check_candidates(name: str, before: Captured, stdout: str) -> None:
    if name.startswith('candidates-'):
        equal(re.findall('^(261001-candidate-[12]) scaffold=true body=true resources=true$', stdout, re.M), [C, D], 'candidate listing/readiness')
    else:
        if before.sources[C].decode() not in stdout:
            raise AssertionError('candidate source missing')
        if not all((value in stdout for value in ('scaffoldValid: true', 'bodyReady: true', 'resourceReady: true'))):
            raise AssertionError('candidate readiness missing')

def check_check(name: str, stdout: str) -> None:
    expected = '10000 reports checked; full index current' if name == 'check-full' else '1 selected reports checked; index not checked'
    if expected not in stdout:
        raise AssertionError('check reported coverage differs')

def check_list(name: str, before: Captured, stdout: str) -> None:
    entries = required_index(before).entries
    if name == 'list-window':
        expected = sorted(entries)[:10]
    else:
        expected = sorted((ident for ident, record in before.records.items() if any((target == '261001-record-00002' and kind == '补充' for kind, target, _ in record.relations))))[:10]
    equal(re.findall('^- (\\S+) \\d{4}-', stdout, re.M), expected, 'list ordered IDs')

def check_search(name: str, before: Captured, stdout: str, stderr: str) -> None:
    if name.startswith('metadata-'):
        matched = 1 if name == 'metadata-few' else 10000
        returned = min(matched, 10)
        if f'matched={matched}' not in stdout or f'returned={returned}' not in stdout:
            raise AssertionError('metadata exact matched/returned')
        expected = [A] if matched == 1 else sorted(required_index(before).entries)[:10]
        equal(re.findall('^(261001-\\S+) \\d{4}-', stdout, re.M), expected, 'metadata result IDs')
    elif name == 'content-selected':
        if 'matched=3' not in stdout or 'returned=3' not in stdout:
            raise AssertionError('content counts')
        equal(re.findall('^(261001-\\S+) \\d{4}-', stdout, re.M), sorted([A, U, V]), 'content selected IDs')
    elif 'investigation-report.file-search-resource-limit' not in stderr or 'candidate file limit was exceeded' not in stderr:
        raise AssertionError('content candidate budget category absent')

def check_trace(name: str, before: Captured, stdout: str) -> None:
    trace = json.loads(stdout)
    anchor = '261001-record-00002'
    adjacency = {key: set() for key in required_index(before).entries}
    for ident, record in before.records.items():
        if ident not in adjacency:
            continue
        for _, target, _ in record.relations:
            adjacency[ident].add(target)
            adjacency[target].add(ident)
    component = {anchor}
    queue = [anchor]
    while queue:
        for target in sorted(adjacency[queue.pop(0)]):
            if target not in component:
                component.add(target)
                queue.append(target)
    if name == 'trace-json':
        equal(set(trace['traceIds']), component, 'trace component')
        equal(trace['coverage']['complete'], True, 'trace complete coverage')
    else:
        equal(len(trace['traceIds']), 2, 'trace budget returned count')
        equal(trace['coverage']['complete'], False, 'trace bounded coverage')
        if not trace['frontier']:
            raise AssertionError('trace budget missing frontier')
    equal(trace['contextIds'], [], 'simple sparse graph unexpected context')
    for ident, entry in trace['entries'].items():
        value = required_index(before).entries[ident]
        equal(entry, {key: value[key] for key in ('title', 'formedAt', 'question', 'tags', 'relations')}, 'trace entry projection')
`````

## `investigation/methods/posterior_stage.py`

逻辑来源：`investigation/methods/posterior_stage.py`。

展示输入：2716 字节，SHA-256 `f04efec8bc1bb01f977219ebc34f05ba2286cc74b90b9e506b23ca332358888f`。

`````python
"""Scope-specific exact pending bytes, modes and deletion preservation."""
from __future__ import annotations
from pathlib import Path
from fixture import COLLECTION
from oracle import git
from prepare import A
from posterior_state import Captured, INDEX, equal, required_index, parse_index, source_path

def normalized_pending(values: dict[str, dict[str, object]]) -> dict[str, dict[str, object]]:
    return {path: {key: value for key, value in fact.items() if key != 'objectId'} for path, fact in values.items()}

def check_stage(root: Path, name: str, scope: str, before: Captured, after: Captured, stdout: str) -> None:
    selected = '261001-record-00001' if name.endswith('-owner') else A
    equal(after.worktree, before.worktree, 'stage changed worktree')
    unchanged = name.endswith('-unchanged')
    if unchanged:
        equal(after.pending, before.pending, 'stage unchanged pending differs')
    if 'changed: ' + ('false' if unchanged else 'true') not in stdout:
        raise AssertionError('stage changed status differs')
    expected_pending = {path: dict(fact) for path, fact in before.pending.items()}
    if scope in {'all', 'domain'}:
        resource_prefix = COLLECTION + '/_resources/' + selected + '/'
        paths = {source_path(after, selected)} | {path for path in set(before.pending) | set(after.worktree) if path.startswith(resource_prefix)}
        for path in paths:
            if path not in after.worktree:
                expected_pending.pop(path, None)
                continue
            fact = after.worktree[path]
            expected_pending[path] = {'mode': '100755' if fact['mode'] & 73 else '100644', 'sha256': fact['sha256'], 'bytes': fact['bytes']}
    if scope in {'all', 'index'}:
        actual = parse_index(git(root, 'show', ':' + INDEX))
        original = parse_index(git(root, 'cat-file', 'blob', before.pending[INDEX]['objectId']))
        current = required_index(after)
        expected_entries = dict(original.entries)
        expected_entries[selected] = current.entries[selected]
        expected_revisions = dict(original.revisions)
        expected_revisions[selected] = current.revisions[selected]
        equal(actual.entries, expected_entries, 'stage pending index entries')
        equal(actual.revisions, expected_revisions, 'stage pending index source revisions')
        equal(actual.envelope, original.envelope, 'stage pending index envelope')
        equal(actual.revision_metadata, original.revision_metadata, 'stage pending index metadata revision')
        expected_pending[INDEX] = dict(after.pending[INDEX])
    equal(normalized_pending(after.pending), normalized_pending(expected_pending), 'stage exact pending bytes/modes/deletions')
`````

## `investigation/methods/posterior_state.py`

逻辑来源：`investigation/methods/posterior_state.py`。

展示输入：4534 字节，SHA-256 `de3cc4325d7cbabed59c7a2488398fa5d1d0ceb6338357d92ed5d275aa466603`。

`````python
"""Validated capture models and shared exact-state assertions for this measurement."""
from __future__ import annotations
from dataclasses import dataclass
import json
from pathlib import Path
from typing import TypedDict
from fixture import COLLECTION
from oracle import Record, parse_record, worktree_manifest, pending_manifest, manifest_delta
INDEX = COLLECTION + '/investigation-index.json'

class FileFact(TypedDict):
    sha256: str
    bytes: int
    mode: int

class PendingFact(TypedDict):
    sha256: str
    bytes: int
    mode: str
    objectId: str

@dataclass(frozen=True)
class IndexSnapshot:
    document: dict[str, object]
    envelope: dict[str, object]
    entries: dict[str, dict[str, object]]
    revisions: dict[str, str]
    revision_metadata: str

@dataclass(frozen=True)
class Captured:
    worktree: dict[str, FileFact]
    pending: dict[str, PendingFact]
    records: dict[str, Record]
    sources: dict[str, bytes]
    index: IndexSnapshot | None

def object_value(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict) or not all((isinstance(key, str) for key in value)):
        raise ValueError(label + ' must be an object with string keys')
    return {str(key): item for key, item in value.items()}

def parse_index(data: bytes) -> IndexSnapshot:
    raw: object = json.loads(data)
    document = object_value(raw, 'index')
    entries_raw = object_value(document.get('entries'), 'entries')
    entries = {key: object_value(value, 'index entry ' + key) for key, value in entries_raw.items()}
    revision = object_value(document.get('sourceRevision'), 'sourceRevision')
    revision_raw = object_value(revision.get('entries'), 'sourceRevision.entries')
    if not all((isinstance(value, str) for value in revision_raw.values())):
        raise ValueError('sourceRevision entries must be strings')
    revisions = {key: str(value) for key, value in revision_raw.items()}
    metadata = revision.get('metadata')
    if not isinstance(metadata, str):
        raise ValueError('sourceRevision.metadata must be string')
    envelope = {key: value for key, value in document.items() if key not in {'entries', 'sourceRevision'}}
    return IndexSnapshot(document, envelope, entries, revisions, metadata)

def capture(root: Path) -> Captured:
    directory = root / COLLECTION
    records: dict[str, Record] = {}
    sources: dict[str, bytes] = {}
    for file in directory.iterdir():
        if file.is_file() and (file.suffix == '.md' or file.name.startswith('_candidate.')):
            record = parse_record(file, directory)
            if record.id in records:
                raise AssertionError('duplicate independently parsed ID ' + record.id)
            records[record.id] = record
            sources[record.id] = file.read_bytes()
    index = root / INDEX
    return Captured(worktree_manifest(root), pending_manifest(root), records, sources, parse_index(index.read_bytes()) if index.exists() else None)

def equal(actual: object, expected: object, label: str) -> None:
    if actual != expected:
        raise AssertionError(label)

def required_index(state: Captured) -> IndexSnapshot:
    if state.index is None:
        raise AssertionError('required independent index missing')
    return state.index

def protect_index_envelope(before: Captured, after: Captured) -> None:
    if before.index is not None and after.index is not None:
        equal(after.index.envelope, before.index.envelope, 'index envelope changed')
        equal(after.index.revision_metadata, before.index.revision_metadata, 'sourceRevision.metadata changed')

def exact_worktree_delta(before: Captured, after: Captured, allowed: set[str]) -> None:
    equal(set(manifest_delta(before.worktree, after.worktree)), allowed, 'exact worktree delta differs')

def source_path(state: Captured, ident: str) -> str:
    return COLLECTION + '/' + state.records[ident].path

def relation_bytes(before: bytes, relations: tuple[tuple[str, str, str | None], ...]) -> bytes:
    text = before.decode()
    start = text.index('\nrelations:') + 1
    end = text.index('\n---', start)
    lines = ['relations:'] if relations else ['relations: []']
    for kind, target, summary in relations:
        lines.extend(['  - type: ' + json.dumps(kind, ensure_ascii=False), '    target: ' + json.dumps(target, ensure_ascii=False)])
        if summary is not None:
            lines.append('    summary: ' + json.dumps(summary, ensure_ascii=False))
    return (text[:start] + '\n'.join(lines) + text[end:]).encode()
`````

## `investigation/methods/prepare.py`

逻辑来源：`investigation/methods/prepare.py`。

展示输入：7760 字节，SHA-256 `4682cd4acd477f314c09e6c992eccbff84c565484ad47155682c6fb9c6ceaccd`。

`````python
"""Build immutable per-branch fixtures; run only with the preparation lease."""
from __future__ import annotations
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
from fixture import ROOT, FROZEN, ORIGINAL, FIXED, COLLECTION, ENV, run, init_git, freeze
from oracle import verify_index, worktree_manifest, pending_manifest
A = '261001-record-09999'
B = '261001-record-10000'
C = '261001-candidate-1'
D = '261001-candidate-2'
U = '261001-record-09997'
V = '261001-record-09998'
PREPARED = ROOT / 'prepared'

def invoke(target: Path, key: str, *args: str) -> None:
    run(['node', str(FROZEN), '--root', str(target), *args], target, ROOT / 'preparation-logs' / key)

def source(target: Path, ident: str) -> Path:
    d = target / COLLECTION
    found = [p for p in d.iterdir() if p.is_file() and p.suffix == '.md' and (f'id: "{ident}"' in p.read_text().split('---', 2)[1])]
    if len(found) != 1:
        raise ValueError(f'fixture source not unique: {ident}')
    return found[0]

def edit_title(target: Path, ident: str, suffix: str) -> None:
    file = source(target, ident)
    text = file.read_text()
    text = text.replace(f'title: "benchmark {ident}"', f'title: "benchmark {ident} {suffix}"', 1)
    file.write_text(text)

def owner(target: Path, ident: str, candidate: bool) -> None:
    file = target / COLLECTION / f'_candidate.{ident}' if candidate else source(target, ident)
    file.write_text(file.read_text() + f'\n## 随附资源\n- [evidence](./_resources/{ident}/evidence.txt)\n')
    resource = target / COLLECTION / '_resources' / ident / 'evidence.txt'
    resource.parent.mkdir(parents=True)
    resource.write_bytes(b'0123456789abcdef0123456789abcdef')

def build_base() -> Path:
    PREPARED.mkdir(exist_ok=True)
    target = PREPARED / 'base'
    if target.exists():
        raise FileExistsError(target)
    target.mkdir()
    archive = subprocess.check_output(['git', '-C', str(ORIGINAL), 'archive', FIXED, COLLECTION], env=ENV)
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:') as stream:
        for member in stream.getmembers():
            resolved = (target / member.name).resolve()
            if not resolved.is_relative_to(target) or not (member.isfile() or member.isdir()):
                raise ValueError('unsafe source archive member')
        stream.extractall(target, filter='data')
    init_git(target)
    invoke(target, 'base-sync', 'sync-index')
    records = verify_index(target / COLLECTION)
    if len(records) != 10000 or sum((len(r.relations) for r in records.values())) != 9000:
        raise AssertionError('formal fixture load differs')
    freeze(target, 'base')
    run(['git', 'repack', '-a', '-d', '--quiet'], target, ROOT / 'preparation-logs/base-pack')
    return target

def prepare_variant(base: Path, key: str) -> Path:
    target = PREPARED / key
    if target.exists():
        raise FileExistsError(target)
    shutil.copytree(base, target)
    d = target / COLLECTION
    if key == 'missing-index':
        (d / 'investigation-index.json').unlink()
    elif key.startswith('candidate-relation'):
        file = d / f'_candidate.{C}'
        file.write_text(file.read_text().replace('relations: []', f'relations:\n  - type: "补充"\n    target: "{A}"\n    summary: "benchmark predecessor"'))
        if key.endswith('unborn'):
            shutil.rmtree(target / '.git')
            init_git(target)
    elif key == 'bootstrap':
        for item in d.iterdir():
            if item.name.startswith('_candidate.'):
                continue
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        shutil.rmtree(target / '.git')
        init_git(target)
    elif key == 'moved-selected':
        source(target, A).rename(d / 'recovered-selected.md')
    elif key == 'edited-selected':
        edit_title(target, A, 'updated')
    elif key == 'content-tag':
        for ident in (A, U, V):
            file = source(target, ident)
            file.write_text(file.read_text().replace('  - "benchmark"', '  - "benchmark"\n  - "small-content"'))
        invoke(target, key + '-sync', 'sync-index', '--select', A, '--select', U, '--select', V)
    elif key in {'candidate-owner', 'formal-owner', 'candidate-owner-source1', 'formal-owner-sourceA'}:
        candidate = key.startswith('candidate')
        ident = C if key.endswith('source1') else A if key.endswith('sourceA') else D if candidate else B
        owner(target, ident, candidate)
        if not candidate:
            invoke(target, key + '-sync', 'sync-index', '--select', ident)
    elif key.startswith('canonical-'):
        candidate = key.endswith('candidate')
        ident = C if candidate else A
        invoke(target, key + '-rename', 'rename', ident, ident, '--rename-recorded-candidate' if candidate else '--rename-recorded-report')
    elif key == 'stage-owner':
        tree = d / '_resources/261001-record-00001'
        (tree / 'stale.txt').write_bytes(b'stale-unreferenced-resource-12345')
        freeze(target, key + '-head')
        (tree / 'stale.txt').unlink()
        (tree / 'extra.txt').write_bytes(b'extra-unreferenced-resource-12345')
        (tree / 'evidence.txt').write_bytes(b'updated referenced evidence\n')
    elif key.startswith('stage-'):
        if key == 'stage-preserve':
            edit_title(target, U, 'unrelated')
            invoke(target, key + '-U-sync', 'sync-index', '--select', U)
            invoke(target, key + '-U-stage', 'stage', U, '--scope', 'all')
            source(target, V).unlink()
            invoke(target, key + '-V-sync', 'sync-index', '--select', V)
            invoke(target, key + '-V-stage', 'stage', V, '--scope', 'all')
            for file in (base / COLLECTION).iterdir():
                if file.is_file() and (file.suffix == '.md' or file.name == 'investigation-index.json'):
                    shutil.copy2(file, d / file.name)
            sentinel = target / 'outside-sentinel.txt'
            sentinel.write_text('unrelated pending sentinel\n')
            run(['git', 'add', 'outside-sentinel.txt'], target, ROOT / 'preparation-logs' / f'{key}-sentinel')
        if key == 'stage-reselect':
            edit_title(target, A, 'version1')
            invoke(target, key + '-v1-sync', 'sync-index', '--select', A)
            invoke(target, key + '-v1-stage', 'stage', A, '--scope', 'all')
            file = source(target, A)
            file.write_text(file.read_text().replace(' version1"', ' version2"', 1))
        else:
            edit_title(target, A, 'version2')
        invoke(target, key + '-v2-sync', 'sync-index', '--select', A)
        if key.startswith('stage-unchanged-'):
            invoke(target, key + '-first-stage', 'stage', A, '--scope', key.removeprefix('stage-unchanged-'))
    else:
        raise ValueError(f'unknown fixture key {key}')
    if key not in {'missing-index', 'bootstrap', 'moved-selected', 'edited-selected'}:
        verify_index(d)
    (PREPARED / f'{key}.manifest.json').write_text(json.dumps({'worktree': worktree_manifest(target), 'pending': pending_manifest(target)}, ensure_ascii=False, sort_keys=True) + '\n')
    return target
if __name__ == '__main__':
    import sys
    if sys.argv[1:] != ['--lease-approved']:
        raise ValueError('preparation requires explicit --lease-approved')
    base = build_base()
    matrix = json.loads((ROOT / 'matrix.json').read_text())
    keys = sorted({row['setup'] for row in matrix} - {'base'})
    for key in keys:
        prepare_variant(base, key)
        print(key, flush=True)
    (ROOT / 'fixture-summary.json').write_text(json.dumps({'fixedInput': FIXED, 'formal': 10000, 'edges': 9000, 'preparedKeys': ['base', *keys]}, indent=2) + '\n')
`````

## `investigation/methods/run.py`

逻辑来源：`investigation/methods/run.py`。

展示输入：6704 字节，SHA-256 `cc406dd766314bd3fb45df911862af1605220fd342aa007f5a318df6f17d8f17`。

`````python
"""Serial approved measurement rounds with immutable fixtures and independent posterior."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from fixture import ROOT, FROZEN, COLLECTION, ENV
from posterior import capture, check
from posterior_state import Captured
MATRIX = json.loads((ROOT / 'matrix.json').read_text())
RUNROOT = ROOT / 'run-root'
PRELOAD = ROOT.parent / 'decision/instrumentation/preload.mjs'
PROBE = ROOT / 'instrumented-skill-v3/scripts/check-investigations.ts'

def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def git_roles(root: Path, before: Captured) -> dict[str, list[str]]:
    completed = subprocess.run(['git', '-C', str(root), 'ls-tree', '-r', '--format=%(objectname)', 'HEAD'], env=ENV, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    return {'head': sorted(set(completed.stdout.decode().splitlines())) if completed.returncode == 0 else [], 'pending': sorted({value['objectId'] for value in before.pending.values()})}

def sample(row: dict[str, object], round_number: int, mode: str, attempt: Path) -> None:
    name = str(row['id'])
    prefix = attempt / f'{round_number:02d}-{name}'
    prepared = ROOT / 'prepared' / str(row['setup'])
    if RUNROOT.exists():
        if RUNROOT.parent != ROOT or RUNROOT.is_symlink():
            raise ValueError('unsafe sample recovery path')
        shutil.rmtree(RUNROOT)
    shutil.copytree(prepared, RUNROOT)
    before = capture(RUNROOT)
    frozen = json.loads((prepared.parent / (prepared.name + '.manifest.json')).read_text())
    if before.worktree != frozen['worktree'] or before.pending != frozen['pending']:
        raise AssertionError(f'prepared initial bytes drift: {name}')
    argv = [str(x).replace('{runRoot}', str(RUNROOT)) for x in row['argv']]
    env: dict[str, str] = {}
    if mode == 'instrumented':
        output = attempt / f'{round_number:02d}-{name}.probe'
        output.mkdir()
        directory = RUNROOT / COLLECTION
        config = {'outputDir': str(output), 'collectionRoot': str(directory), 'indexFile': str(directory / 'investigation-index.json'), 'candidatePaths': [str(p) for p in directory.iterdir() if p.name.startswith('_candidate.')] + [str(directory / '_candidate.fresh')], 'resourceRoots': [str(directory / '_resources')], 'gitObjectRoles': git_roles(RUNROOT, before), 'hooks': []}
        config_path = Path(str(prefix) + '.probe-config.json')
        config_path.write_text(json.dumps(config, ensure_ascii=False) + '\n')
        argv = ['node', '--import', str(PRELOAD), str(PROBE), *argv[2:]]
        env = {'RECORD_BENCH_PROBE_CONFIG': str(config_path)}
    spec = {'argv': argv, 'cwd': str(RUNROOT), 'outputPrefix': str(prefix), 'timeoutSeconds': 600, 'domain': 'investigation', 'scenario': name, 'iteration': round_number, 'mode': mode, 'environment': env}
    spec_path = Path(str(prefix) + '.spec.json')
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + '\n')
    measured = subprocess.run(['python3', str(ROOT.parent / 'methods/measure.py'), str(spec_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if measured.returncode:
        raise RuntimeError('outer collector failure: ' + measured.stderr.decode())
    metrics = json.loads(measured.stdout)
    stdout = Path(str(prefix) + '.stdout').read_text()
    stderr = Path(str(prefix) + '.stderr').read_text()
    try:
        if metrics['outcome'] != 'exited':
            raise AssertionError(f"CLI did not exit normally: {metrics['outcome']}")
        posterior = check(RUNROOT, row, before, stdout, stderr, metrics['exitCode'])
        posterior['inputWorktreeSha256'] = digest(before.worktree)
        posterior['inputPendingSha256'] = digest(before.pending)
        posterior['finalWorktreeSha256'] = digest(posterior['afterWorktree'])
        posterior['finalPendingSha256'] = digest(posterior['afterPending'])
        posterior['normalization'] = 'none: identical fixed run-root; no output fields ignored'
        reference = attempt / f'00-{name}'
        if round_number != 0:
            for channel in ('stdout', 'stderr'):
                if Path(str(reference) + '.' + channel).read_bytes() != Path(str(prefix) + '.' + channel).read_bytes():
                    raise AssertionError(f'{mode} output differs from first normal sample: {channel}')
            initial = json.loads(Path(str(reference) + '.posterior.json').read_text())
            for key in ('inputWorktreeSha256', 'inputPendingSha256', 'finalWorktreeSha256', 'finalPendingSha256'):
                if posterior[key] != initial[key]:
                    raise AssertionError(f'{mode} state differs from first normal sample: {key}')
        if mode == 'instrumented':
            summarized = subprocess.run(['python3', str(ROOT.parent / 'decision/instrumentation/summarize.py'), str(output)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            if summarized.returncode:
                raise AssertionError('probe summary failed: ' + summarized.stderr.decode())
            Path(str(prefix) + '.workload.json').write_bytes(summarized.stdout)
        Path(str(prefix) + '.posterior.json').write_text(json.dumps(posterior, ensure_ascii=False, sort_keys=True) + '\n')
    except Exception as failure:
        Path(str(prefix) + '.failure.json').write_text(json.dumps({'errorType': type(failure).__name__, 'error': str(failure), 'scenario': name, 'mode': mode, 'iteration': round_number}, ensure_ascii=False, indent=2) + '\n')
        raise
    print(json.dumps({'scenario': name, 'iteration': round_number, 'mode': mode, 'wallSeconds': metrics['wallSeconds'], 'posteriorPassed': True}), flush=True)

def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] != '--formal-lease-approved':
        raise ValueError('usage: run.py --formal-lease-approved <fresh-attempt-name>')
    attempt = ROOT / 'raw' / sys.argv[2]
    if attempt.exists() or not attempt.resolve().is_relative_to(ROOT / 'raw'):
        raise FileExistsError('attempt must be fresh and owned')
    attempt.mkdir(parents=True)
    schedule = [(0, 'normal', MATRIX), (1, 'normal', list(reversed(MATRIX))), (2, 'normal', MATRIX), (3, 'instrumented', MATRIX)]
    (attempt / 'order.json').write_text(json.dumps([{'iteration': i, 'mode': mode, 'scenarios': [r['id'] for r in rows]} for i, mode, rows in schedule], ensure_ascii=False, indent=2) + '\n')
    for iteration, mode, rows in schedule:
        for row in rows:
            sample(row, iteration, mode, attempt)
if __name__ == '__main__':
    main()
`````

## `investigation/methods/smoke.py`

逻辑来源：`investigation/methods/smoke.py`。

展示输入：3424 字节，SHA-256 `bb60dd4873836e0e002aee93c3dadece690aeff23f5e1ef4e7f6014cb21dbc44`。

`````python
"""Small-fallback readiness check of public CLI, domain hooks and posterior."""
from __future__ import annotations
import json
from pathlib import Path
import subprocess
from fixture import ROOT, FROZEN, COLLECTION, run
from oracle import worktree_manifest, pending_manifest, verify_index
RUN = ROOT / 'smoke-20'
LOG = ROOT / 'smoke-evidence-v3'
LOG.mkdir(exist_ok=True)
PRELOAD = ROOT.parent / 'decision/instrumentation/preload.mjs'
PROBE = ROOT / 'instrumented-skill-v3/scripts/check-investigations.ts'

def measure(name: str, args: list[str], probe: bool=False) -> tuple[str, str]:
    before = {'worktree': worktree_manifest(RUN), 'pending': pending_manifest(RUN)}
    prefix = LOG / name
    argv = ['node']
    env: dict[str, str] = {}
    if probe:
        output = LOG / (name + '-events')
        output.mkdir()
        directory = RUN / COLLECTION
        config = {'outputDir': str(output), 'collectionRoot': str(directory), 'indexFile': str(directory / 'investigation-index.json'), 'candidatePaths': [str(x) for x in directory.glob('_candidate.*')], 'resourceRoots': [str(directory / '_resources')], 'hooks': []}
        configfile = LOG / (name + '-config.json')
        configfile.write_text(json.dumps(config))
        env = {'RECORD_BENCH_PROBE_CONFIG': str(configfile)}
        argv += ['--import', str(PRELOAD)]
    argv += [str(PROBE if probe else FROZEN), '--root', str(RUN), *args]
    spec = {'argv': argv, 'cwd': str(RUN), 'outputPrefix': str(prefix), 'timeoutSeconds': 600, 'domain': 'investigation', 'scenario': name, 'iteration': 0, 'mode': 'smoke', 'environment': env}
    path = LOG / (name + '.spec.json')
    path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + '\n')
    result = subprocess.run(['python3', str(ROOT.parent / 'methods/measure.py'), str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    metrics = json.loads(result.stdout)
    if metrics['exitCode'] != 0:
        raise AssertionError(f'smoke CLI failure: {name}; ' + prefix.with_suffix('.stderr').read_text())
    after = {'worktree': worktree_manifest(RUN), 'pending': pending_manifest(RUN)}
    if before != after:
        raise AssertionError(f'readonly smoke changed bytes {name}')
    (LOG / (name + '.posterior.json')).write_text(json.dumps({'passed': True, 'before': before, 'after': after}, ensure_ascii=False) + '\n')
    return (Path(str(prefix) + '.stdout').read_text(), Path(str(prefix) + '.stderr').read_text())
if __name__ == '__main__':
    normal = measure('full-normal', ['check'])
    probe = measure('full-probe', ['check'], True)
    if normal != probe:
        raise AssertionError('normal/probe smoke output differs')
    measure('candidate-normal', ['show-candidate', '261001-candidate-1'])
    for kind, ident, flag in [('formal', '261001-record-00002', '--rename-recorded-report'), ('candidate', '261001-candidate-1', '--rename-recorded-candidate')]:
        run(['node', str(FROZEN), '--root', str(RUN), 'rename', ident, ident, flag], RUN, LOG / (kind + '-canonical-prep'))
        before = verify_index(RUN / COLLECTION)
        measure(kind + '-noop', ['rename', ident, ident])
        if verify_index(RUN / COLLECTION) != before:
            raise AssertionError('noop index changed')
    (LOG / 'summary.json').write_text(json.dumps({'passed': True, 'formal': 20, 'normalProbeOutputsEqual': True, 'trueCanonicalNoops': ['formal', 'candidate']}, indent=2) + '\n')
`````

## `investigation/methods/smoke_mutation.py`

逻辑来源：`investigation/methods/smoke_mutation.py`。

展示输入：2272 字节，SHA-256 `e04e70c5d62df9341198b19874586ef1e17805a36917e3d35d3a1ad3525bec87`。

`````python
"""Small real-public-CLI self-proof of command-group posterior integration."""
from __future__ import annotations
import json
from pathlib import Path
import shutil
from fixture import ROOT, FROZEN, COLLECTION, run, freeze
from posterior import capture, check
from prepare import A, B

def main() -> None:
    output = ROOT / 'mutation-smoke'
    output.mkdir()
    base = output / 'base'
    shutil.copytree(ROOT / 'smoke-20', base)
    directory = base / COLLECTION
    template = (directory / 'record-00002.md').read_text()
    for ident in (A, B):
        (directory / (ident + '.md')).write_text(template.replace('261001-record-00002', ident))
    tree = directory / '_resources/261001-record-00001'
    (tree / 'stale.txt').write_bytes(b'stale owner member\n')
    run(['node', str(FROZEN), '--root', str(base), 'sync-index'], base, output / 'base-sync')
    freeze(base, 'mutation-smoke-base')
    matrix = json.loads((ROOT / 'matrix.json').read_text())
    keys = ['new-index', 'publish-zero', 'publish-preflight', 'relations-changed', 'rename-candidate-no-owner', 'rename-formal-no-owner', 'discard-candidate-no-owner', 'discard-formal-no-owner', 'stage-all-owner', 'stage-domain-owner']
    for key in keys:
        row = next((value for value in matrix if value['id'] == key))
        target = output / key
        shutil.copytree(base, target)
        if key.endswith('-owner') and key.startswith('stage-'):
            owner = target / COLLECTION / '_resources/261001-record-00001'
            (owner / 'stale.txt').unlink()
            (owner / 'extra.txt').write_bytes(b'new owner member\n')
            (owner / 'evidence.txt').write_bytes(b'changed referenced evidence\n')
        before = capture(target)
        argv = [str(value).replace('{runRoot}', str(target)) for value in row['argv']]
        log = output / (key + '-command')
        run(argv, target, log)
        result = check(target, row, before, log.with_suffix('.stdout').read_text(), log.with_suffix('.stderr').read_text(), 0)
        (output / (key + '.posterior.json')).write_text(json.dumps(result, ensure_ascii=False) + '\n')
    (output / 'summary.json').write_text(json.dumps({'passed': True, 'formal': 22, 'scenarios': keys}, indent=2) + '\n')
if __name__ == '__main__':
    main()
`````

## `investigation/methods/summarize_results.py`

逻辑来源：`investigation/methods/summarize_results.py`。

展示输入：5828 字节，SHA-256 `1444bf8f4c53ccc8897e6abc1c26c4859cd5fb1465294e7853f3cfadad4529fb`。

`````python
"""Offline summary of retained samples; never invokes the measured product."""
from __future__ import annotations
import csv
import hashlib
import json
from pathlib import Path
import statistics
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'raw/accepted-v1'

def read(path: Path) -> object:
    return json.loads(path.read_text())

def summarize() -> None:
    matrix=read(ROOT/'matrix.json')
    results=[]
    for scenario in matrix:
        name=scenario['id']
        samples=[read(RAW/f'{iteration:02d}-{name}.metrics.json') for iteration in range(3)]
        posteriors=[read(RAW/f'{iteration:02d}-{name}.posterior.json') for iteration in range(4)]
        probe=read(RAW/f'03-{name}.workload.json')
        if not all(value['passed'] for value in posteriors):
            raise AssertionError('unaccepted posterior '+name)
        metrics={}
        for key in ('wallSeconds','userSeconds','systemSeconds','cpuSeconds','maxRssKiB'):
            values=[sample[key] for sample in samples]
            metrics[key]={'min':min(values),'median':statistics.median(values),'max':max(values),'samples':values}
        io=[{key:value for key,value in item.items() if key!='paths'} for item in probe['io']]
        file_writes={'calls':0,'bytes':0}
        stdio_writes={'calls':0,'bytes':0}
        for item in probe['io']:
            if item['direction']!='write':
                continue
            is_stdio=all(path in {'unknown-fd:1','unknown-fd:2'} for path in item['paths'])
            target=stdio_writes if is_stdio else file_writes
            target['calls']+=item['calls']
            target['bytes']+=item['bytes']

        roles={}
        for command in probe['git']:
            batch=command['batch']
            if batch is None:
                continue
            for blob in batch.get('blobs',[]):
                role='+'.join(blob.get('roles',[])) or 'unknown'
                fact=roles.setdefault(role,{'blobs':0,'payloadBytes':0})
                fact['blobs']+=1
                fact['payloadBytes']+=blob['bytes']
        results.append({'scenario':name,'command':scenario['argv'][4],'setup':scenario['setup'],'workload':scenario['workload'],'expectedExit':scenario['expectedExit'],'normalMetrics':metrics,'normalCount':3,'instrumentedCount':1,'normalProbeOutputAndStateEqual':True,'normalization':'none','probe':{'io':io,'counts':probe['counts'],'gitBatchCount':probe['gitBatchCount'],'gitActualPayloadBytes':probe['gitActualPayloadBytes'],'gitStdoutBytes':probe['gitStdoutBytes'],'gitInitialObjectMembership':roles,'threadCount':len(probe['threads']),'completedThreads':sum(thread['completed'] for thread in probe['threads']),'successfulNodeFileWrites':file_writes,'stdioWrites':stdio_writes,'unknown':probe['unknown']},'probeRaw':str(RAW/f'03-{name}.workload.json'),'posteriorDelta':{'worktree':posteriors[0]['worktreeDelta'],'pending':posteriors[0]['pendingDelta']}})
    output={'schemaVersion':1,'scenarios':len(results),'normalSamples':len(results)*3,'instrumentedSamples':len(results),'formalTimingScope':'fresh Node process/default heap; CLI, output and waited children included; warm filesystem fixtures; preparation/oracle/counters excluded','results':results,'firstFailures':[str(path) for path in RAW.glob('*.failure.json')]}
    (ROOT/'results-summary.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    with (ROOT/'normal-timings.csv').open('w') as stream:
        writer=csv.writer(stream)
        fields=['scenario','setup','exit']+[key+'_'+stat for key in ('wallSeconds','cpuSeconds','maxRssKiB') for stat in ('min','median','max')]
        writer.writerow(fields)
        for result in results:
            writer.writerow([result['scenario'],result['setup'],result['expectedExit']]+[result['normalMetrics'][key][stat] for key in ('wallSeconds','cpuSeconds','maxRssKiB') for stat in ('min','median','max')])
    lines=['# IR 1W全入口测量结果','',f'{len(results)}场景；每场景3次normal+1次独立instrumented。完整输出、metrics、后验与probe事件在`raw/accepted-v1/`；本汇总不替代原始证据。','','| 场景 | wall秒 min / median / max | CPU秒 min / median / max | RSS MiB min / median / max |','|---|---:|---:|---:|']
    for result in results:
        def metric(key: str,scale: float=1.0) -> str:
            return ' / '.join(f'{result["normalMetrics"][key][stat]/scale:.3f}' for stat in ('min','median','max'))
        lines.append(f'| {result["scenario"]} | {metric("wallSeconds")} | {metric("cpuSeconds")} | {metric("maxRssKiB",1024)} |')
    lines.extend(['','## 计数边界','','- FS是成功完成的Node字节API调用/返回字节/unique path，覆盖reader workers；不是kernel syscall或物理磁盘I/O。rename/unlink及Git内部文件写不在字节write计数；其最终效果由完整W/P后验核验。','- Git batch payload按真实framing计量，不以retained prefix估算。HEAD/pending为初态OID membership，可双归属而非caller phase，不能双计求和。','- actual file writes汇总成功Node字节API并扣除确认的stdout/stderr fd:1/2；原始unknown分类保持，temporary scaffold/index常归other，candidate/index write=0不代表未写。文件写字节包含transaction temp，不等于最终持久delta。','- graph/context/report/frontmatter/indexJsonParse分别计，不能把嵌套parser计数相加称总parse。','- normal和probe所有完整stdout/stderr及初末W/P hash均零归一化直接相等。','- bootstrap为0formal首次建立边界，不代表1W；其他场景1W并按setup注明候选/资源/待提交变体。','- 高耗时/读取放大属于本次固定fixture观察；没有单场景profile、修产品或据此声称根因性能上限。'])
    (ROOT/'summary.md').write_text('\n'.join(lines)+'\n')
if __name__=='__main__':
    summarize()
`````
