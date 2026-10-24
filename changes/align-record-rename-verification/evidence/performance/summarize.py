"""Render small human table without conflating normal and instrumented samples."""
import json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
rows=[r for r in json.loads((HERE/'summary.json').read_text()) if r['size']==10000]
lines=['# 正式 10k 逐值与分阶段\n','秒；normal 各 2 次，instrumented 各 1 次独立列出。不估计置信区间，不按差值扣除仪器开销。\n','| Version | 场景 | normal 1 | normal 2 | instrumented |','| --- | --- | ---: | ---: | ---: |']
for v in ['before','after']:
 for d,s in [('dr','rename'),('ir','rename'),('dr','discard'),('ir','discard')]:
  group=[r for r in rows if (r['version'],r['domain'],r['scenario'])==(v,d,s)]
  if not group:continue
  normal=sorted([r for r in group if r['mode']=='normal'],key=lambda r:r['rep']);ins=[r for r in group if r['mode']=='instrumented'];assert len(normal)==2 and len(ins)==1
  lines.append(f'| {v} | {d.upper()} {s} | '+ ' | '.join(f"{r['metrics']['wallMs']/1000:.3f}" for r in normal+ins)+' |')
lines+=['\n## 分阶段（仅 instrumented）\n','prepare 为 shared prepare；外层 domain prepare 见 JSON 中具名包容 interval，未计入本列。fresh+pre 与 post 合计用于跨版本义务范围对齐。残差含 launch/import/未插桩 domain 工作，不是纯 prepare。\n','| Version | 场景 | prepare | fresh+pre | write loop | publish | shared post | domain post | cleanup | 外部及未归因残差 |','| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
for r in rows:
 if r['mode']!='instrumented':continue
 p=r['inclusiveMs'];names=['shared.prepare','freshPlusSharedPreverify','write.loop','publish','shared.postverify','domain.postverify','cleanup','externalAndUnattributedResidual'];lines.append(f"| {r['version']} | {r['domain'].upper()} {r['scenario']} | "+' | '.join(f'{p.get(n,0)/1000:.3f}' for n in names)+' |')
lines+=['\n`resources.apply` 对本输入为空操作（零选中资源），精确值保留在 JSON；本表四舍五入至毫秒。每个包容 interval 的排他拆分、计划写集/unchanged/guards 计数、CPU/RSS 与最终 delta 见 `summary.json`。\n']
(HERE/'summary-table.md').write_text('\n'.join(lines))
