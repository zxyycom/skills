#!/usr/bin/env python3
import json, subprocess, sys, hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
repo=Path('/workspace/skills')
cli=repo/'skills/decision-records/scripts/decision-records.ts'
rust=root/'target/release/decision-records-rust-experiment'

def call(args):
 return subprocess.run(args, text=True, capture_output=True)

def generate(d):
 p=root/f'fixture-{d}'; base=p/'docs/decisions'; (base/'archive').mkdir(parents=True)
 for i in range(d+1):
  id=f'260101-bench-{i:05d}'; old=i==0
  rel='[]' if old else '\n  - type: 修订\n    target: 260101-bench-00000'
  s=f'''---
title: Benchmark decision {i:05d}
id: {id}
status: {'archived' if old else 'active'}
alignment: aligned
createdAt: 2026-01-01T00:00:00+00:00
purpose: Deterministic benchmark decision.
background: Benchmark source for graph comparison.
decision: Keep a reproducible fixture.
tags:
  - benchmark
relations: {rel}
---

## 目的
- Deterministic benchmark decision.

## 背景
- Benchmark source for graph comparison.

## 决策
- 采用: Keep a reproducible fixture.
'''
  (base/('archive' if old else '')/f'{id}.md').write_text(s)
 for command in ['sync-index','check']:
  v=call(['node',str(cli),command,'--root',str(p)])
  if v.returncode: raise RuntimeError(f'{command}: {v.stdout} {v.stderr}')
 args=['trace','260101-bench-00000','--direction','successors','--max-records','1','--json','--root',str(p)]
 a=call(['node',str(cli),*args]); b=call([str(rust),*args]); print(json.dumps({'degree':d,'sync_check':True,'node_rc':a.returncode,'rust_rc':b.returncode,'json_equal':json.loads(a.stdout)==json.loads(b.stdout) if a.returncode==b.returncode==0 else False,'node_stderr':a.stderr,'rust_stderr':b.stderr},ensure_ascii=False),flush=True)
for d in [8,16,32,64]:generate(d)
