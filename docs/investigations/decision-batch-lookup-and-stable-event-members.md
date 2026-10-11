---
title: "决策批量定位与稳定事件成员复杂度"
id: "261011-decision-batch-lookup-and-stable-event-members"
formedAt: "2026-10-11T13:18:13Z"
question: "批量 selector 与稀疏大重划能否消除阶段查找和完整成员的乘积成本，同时保留动态快照与接纳语义？"
tags:
  - "decision-records"
  - "performance"
  - "semantic-fidelity"
relations:
  - type: "补充"
    target: "261011-decision-snapshot-stage-and-event-costs"
    summary: "补充批量定位与大重划剩余乘积成本及动态边界"
---

## 形成时背景

前序轮次已完成发布快照查询、stage 写前单阶段扫描、领域事件构造和呈现优化，同时明确重划不同 direct-set 单位的规范化仍随成员规模增长。本轮从该轮次最终接受的工作树重新取证：正式决策 N=380，前序功能与优化均已存在，Git HEAD 仍为 `223805466196410174d8c58111489f5d7933ed33`。旧/新对照使用这一本轮开始字节副本，而非 HEAD 的更早实现。

本轮关注批量定位与合法大重划的扩展性，当前真实重划仅有两个前序和两个后继。新样本的规模、证据条件与结果需要和前序分别复核，因此以补充关系承接前序的成员成本边界。

## 调查目的

查明一轮 resolution/fresh preparation 的 ID/name 查找能否降为集合建表加所选工作，以及共享 trace 能否同时降低完整事件成员工作和保留表示。保留日期/legacy/name 优先级、歧义、重复首条、锁内新扫描、原子预算、direct 晋升、排序与 continuation 输出。动态 adapter 不收窄；已证明的冻结 Proxy 数组缓存误判单独修复。

## 调查范围与依据

- 取证环境为 2026-10-11、Node 26.8.2、Bun 1.4.2。比较基线是本轮开始时 202 个源码、依赖及生成文件的逐 SHA 字节副本，前后实际运行同层计数：`decisionId` getter 读取（新值含建表）、完整成员数组 numeric descriptor、sort/filter/join 输入项、相关 Set.has 调用。计数用于判断操作复杂度，未测稳定墙钟或 RSS。
- 稀疏圈构型：d 个 archived 前序 p_i、d 个 active 后继 s_i；每个 s_i 仅重划到 p_i 和 p_(i+1 mod d)，N=E=R=2d。领域 consistency、strategy shape/closure 为零错误；完整 trace 使用 both、depth all、budget 2d。独立原生用例还写出完整合法 Markdown 与 archive 路径，经真实生成 Node CLI 查询，另证完整来源和分发执行边界。
- stage/selected sync 的名字解析计数通过 dated-ID 正则 exec 取得，包含入口原有验证等全部日期解析；样本另含 Git fixture 的两条既有记录。完整 ID 与全短名两种选择分别实际运行，成功结果及错误 stdout/stderr/退出码完整对照。完整 ID 路径保持直接定位。
- 35,364 次领域 trace 完整结果深比较，覆盖本轮开始的真实 380 条发布投影、稀疏圈、拆分/归并与普通边交集，全部 anchor、三方向、depth=0/1/2/all、budget=1/2/3/5/10/50/1000。共享稳定/动态单位另比较 144 次 selection；selector 和 preparation 各 24 组对照，successor/group/summary 再比较 25 组解析及 6 组准备结果，stage/selected sync 成功及错误共 34 组完整 CLI 辅助断言；该辅助脚本报告 0 个原生节点。旧 Proxy 错误单独验证修复后的正确结果。
- 12 个新增最小原生节点及对应 Case 承接批量定位、阶段 fresh、混合短名、完整源稀疏圈、生成 Node 预算、共享表示、值身份、Proxy direct/member、iterator 恢复及动态访问次序。完整回归实际通过 DR 301、共享关系图 29、index-runtime 62、Investigation Report 305 个节点；Case 引用/覆盖检查通过 1233 个实体。此前的快照、fresh stage、方向/预算与文本 golden 继续参与回归。实现入口为 [阶段 lookup](../../tools/decision-records/src/decision-record-lookup.ts)、[共享规范化](../../tools/shared/src/graph/trace-ordering.ts) 和 [BFS 接纳](../../tools/shared/src/graph/trace-selection.ts)；[批量定位测试](../../tools/decision-records/tests/batch-lookup.test.ts)、[重划测试](../../tools/decision-records/tests/reallocation-member-complexity.test.ts) 和[动态成员测试](../../tools/shared/tests/trace-member-facts.test.ts)提供稳定回归入口。

## 调查结果与边界

本轮消除了阶段批量查找、单稳定共享成员组处理及保存表示中的乘积成本；动态输入继续独立快照，原子预算与 direct 晋升语义保留。冻结 Proxy 数组的旧缓存错误属于单独验证的有意修复。

N 为该阶段记录数，Q 为解析 selector 数，S 为选中记录数，E_selected 为选中关系边数。批量查找为 O(N+Q+S+E_selected)，另计必要扫描、验证、排序及歧义输出。单个稳定共享成员组 R、U 个单位、累计 direct 目标 T 的成员处理和表示为 O(R+U+T)，另计一次 R 排序、各 direct/BFS 排序及输出；稀疏圈 R=2d、T=O(d)。动态 fallback、不同完整成员数组/集合、必要全图验证和其他错误图算法不承担统一线性承诺。

### 操作计数与表示

| 相同层指标与规模 | 本轮开始实现 | 本轮新实现 |
| --- | --- | --- |
| N=380、S=1/5/20，archive selector 的 ID 读取 | 381 / 1905 / 7620 | 381 / 385 / 400 |
| d=10/100/300，directPredecessors ID 读取（新含建表） | 190 / 10900 / 92700 | 100 / 1000 / 3000 |
| 同规模，完整成员 sort 输入项 | 440 / 40400 / 361200 | 60 / 600 / 1800 |
| 同规模，完整成员 numeric descriptor | 400 / 40000 / 360000 | 20 / 200 / 600 |
| 同规模，完整成员 filter 输入项 | 400 / 40000 / 360000 | 20 / 200 / 600 |
| 同规模，完整成员 join 输入项 | 400 / 40000 / 360000 | 20 / 200 / 600 |
| 同规模，相关 Set.has 调用（含成员接纳和图工作） | 1385 / 121805 / 1085405 | 319 / 3199 / 9599 |
| R=U=20/200/600，规范化保留的完整成员数组槽 | 400 / 40000 / 360000 | 20 / 200 / 600 |

sort 项数包含初始事件和最终结果排序；filter 与 Set.has 计数同时覆盖排序以外的成员工作。表示实验对 R 个共享稳定成员、U 个不同冻结 direct 单位逐个规范化，按私有 normalized 数组指针去重后加总槽数：旧有 U 份，新只有一份。新成员身份后缀只构造一次，各单位引用共享后缀并单独保存 kind。这证明逻辑保存表示及构造成本，引擎字符串驻留与峰值内存未测。

stage/selected sync 的全短名选择在 d=10/100（选择 20/200 个 ID）时，日期解析累计均由 746/43226 降至 328/3028；对应完整 ID 选择保持 306/2826 不变。该指标包含必要验证，不等于仅名字 lookup 成本。

### 原因与实现不变量

批量乘积来自每个 selector 的 records.filter，以及 archive/关系准备循环的 records.find。新 lookup 显式属于 resolution 或当前 fresh preparation，保留 ID 全部匹配的原序与首条记录，名字只在首次需要时建表。锁内来源重读后创建新 lookup；每阶段事实与写前验证、锁、HEAD/CAS 和恢复各自承担原有责任。

共享成员乘积来自不同 direct-set 单位各自证明、复制、排序、构造身份和过滤全部 R 成员。同一次 selection 仅为自有数据槽、稠密且冻结的原生非 Proxy 数组证明和保存事实，继承 iterator 每次仍核对。Proxy 数组走动态快照。batch 去重身份仍为 kind 加成员值，私有成员数组指针只用于复用已证明事实。

完整成员成功接纳与 direct 晋升分开：预算通过且全部成员进入 trace∪context 后才记成功组；再次遇到共享成员组不再完整扫描，但不同 direct 单位仍按原 BFS 晋升 context→trace、扩展 depth 和 nextLayer。预算失败保留完整 remaining units、frontier 与 blockedEvent；稳定数组的证明与归一化事实可在预算检查前复用，成功接纳的组才可免除重复的接纳成员扫描。动态单位继续独立快照，iterator 改变/恢复与原 getter/iterator 次序保留。

### 有意正确性修复与未覆盖边界

本轮开始的 same-unit 缓存已存在错误：冻结 Proxy traceIds 的底层槽未变，继承 Symbol.iterator 的 get trap 从 a 改为 b 后，旧结果仍把 b 留在 context。不同单位旧路径会重新快照，能正确晋升。修复统一排除 Proxy 数组的缓存资格，不拒绝合法输入；同一/不同单位的 direct 变化均晋升 b，成员数组增长时 budget=2 必须阻断 required=3，budget=3 完整接纳。此项与其余旧/新等价对照分别成立。

前序已批准的发布快照语义、完整索引非法图拒绝、show 单记录验证、content 降级、stage scope/pending 保护全部保留。本轮运行时生成包的直接 consumer 为 Decision Records 与 Investigation Report。未验证超大真实图的稳定时延/RSS、跨文件原子快照或所有恶意 Proxy 行为；Proxy 修复验证了上述 direct/member 数组反例，未建立全面 Proxy 行为保证。
