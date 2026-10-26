---
title: "完整事件、关系筛选与终端图的重复扫描收敛"
id: "261011-investigation-event-query-and-trace-rendering"
formedAt: "2026-10-11T09:09:42Z"
question: "如何在不改变查询和事件预算语义时消除正常关系查询的重复聚合与扫描？"
tags:
  - "index-runtime"
  - "investigation-report"
  - "performance"
  - "root-cause-analysis"
  - "semantic-fidelity"
relations: []
---

## 形成时背景

基线为 `a01efb41f9c7863e9c6102c3ceefc4c1ada20922`。合法关系图的正常查询存在三个独立热点：完整拆分／归并事件按每条边重复聚合；`--related-to` 对每个 entry 线性查找同一邻居集合；终端 trace 对每个节点反查完整切片。默认事件预算虽能阻止接纳，昂贵的事件构造却已完成。

本轮跨 Investigation Report（IR）事件语义、共享 selector、Index Runtime 与 renderer，以生产调用计数、完整结果对照和预算反例闭合根因。此前批量定位、深链结构校验和完整内容指纹的调查仅作背景，未在本轮复查，故直接前序关系为空。

## 调查目的

将重复工作收敛到其数据生命周期：同一查询的完整事件聚合一次、每个 exact filter 的 requested identity 集合编译一次、同一终端切片的反向关系索引构建一次。验收保持完整事件接纳、trace/context 区分、最短深度、排序、预算、blockedEvent、frontier，以及 list/search 的筛选依据、total、分页与诊断；JSON 与终端图消费同一查询结果。

## 调查范围与依据

### 方法与证据身份

before 从保存的旧生产 TypeScript 直接导入，after 从工作树生产 TypeScript 直接导入。私有合成发布索引通过完整领域解析和合法图验证；关系图诊断为 `[]`，完整建图包含在 trace 计数内。指标是命名生产调用栈中的 predicate、Set 输入、成员探测、准入证明与反向索引访问，不是 CPU 指令或墙钟时延。

实际运行时为 Bun 1.4.2，其 `process.version` 为兼容字符串 v26.3.0；7 条生成 CLI 对照另以真实 Node v26.8.2 子进程执行。`before.json` 与 `after.json` 保存形成时来源、源码／CLI SHA256 和目标计数，after 共 123 组（其中 108 组为双向完整接纳／阻断矩阵）。`measurement.ts` 保存实际观测代码，供理解方法，不是长期维护的复跑入口。

独立审查发现仪器自用的字段名 `includes` 被全局 hook 误归入生产成员检查。改为调用预先捕获的 native 后真实重测全部 123 组，移除 9,440 次仪器调用；所有其他计数逐样本完全一致，生产 `admissionIncludesCalls` 和对应比较数均为 0。旧观察保留用于审计；计数归零只说明该生产调用消失，其他工作由下列指标分别计量。

### A：完整事件聚合与接纳

合法 degree=d 的拆分或纯归并中心，原重复桶 filter 为 d²，recordIds.includes 逻辑比较为 d²(d+3)/2。单向中心实测：

| d | 原桶访问 | 原成员比较 | after 桶访问 | after 预算 recordIds 访问 | after trace 成员探测 |
| --- | --- | --- | --- | --- | --- |
| 40 | 1,600 | 34,400 | 40 | 41 | 40 |
| 80 | 6,400 | 265,600 | 80 | 81 | 80 |
| 160 | 25,600 | 2,086,400 | 160 | 161 | 160 |

d=80/160、默认 maxRecords=50 时只接纳 anchor，blocked required=81/161，原构造成本仍全额发生。after 每事件冻结双向单位及事件容器共 6 次，其中三个数组合计 2d+2 个成员，冻结成本已计入。

双向样本覆盖中心、首／末成员 anchor、depth=0/1/all 与预算 d/d+1，108 组完整结果均等于旧生产。d=160、预算161的完整接纳样本：桶访问160，域边到单位插入320；双向各规范化一次，identity join 合计322个成员，预算 recordIds 访问322次；后续规范化与成功接纳各复用159次。depth0不构造事件；成员 depth1 闭合 context，后续方向仍可将其提升为 trace。

稳定复用的证明成本也纳入 after：首次双向读取6个 unit 字段 descriptor、483个数组索引 descriptor，数组冻结检查4次／输入体积483；159次命中仅作 O(1) iterator 核对，总 iterator descriptor=163。输入体积表示检查对象规模，不等于引擎内部属性访问次数。

### B：整批 exact membership

原 N 个报告、M 个邻居的逻辑比较为 (N−M)M+M(M+1)/2。N=101/201/401、M=50/100/200、limit=1 时实测3,825/15,150/60,300。after 每查询只构造一次 requested identity Set，输入50/100/200；实际 entry 成员探测101/201/401，total仍为50/100/200，返回仍为1。

身份仍由既有 `scalarIdentity` 定义。独立期待与旧结果对照覆盖布尔／数字／字符串隔离、0/-0、重复 requested/actual、多 source、缺失字段、空 actual、reader 重复查询、overlay、排序与分页。公开边界继续拒绝空 requested、null 和非有限数；私有 matcher 的空量词仍为 all/none=true、any=false。

### C：终端图固定切片

原 T 个 trace 节点、A 个 slice 成员、L 条直接关系的深度反查及两次关系反查产生 Θ(T(A+L)) 扫描。chain/star 的 T=51/101/201、L=50/100/200：原 depth reverse predicate=2,550/10,100/40,200，两次 reverse filter=5,100/20,200/80,400。

after 一次反向索引构建访问50/100/200条边；BFS邻接边访问同为50/100/200，bucket lookup为51/101/201；输出分类访问100/200/400条bucket成员。chain完整输出仍为9,228/18,230/36,330 bytes，star为8,109/15,960/31,660 bytes，与旧文本逐字相同。BFS以游标消费队列；旧 shift 剩余长度只作抽象信号，不解释为引擎实际内存搬移次数。

## 调查结果与边界

### 根因与修复责任

- **IR adapter 拥有完整事件聚合。** split按前序ID、merge按后继ID在单次查询内懒聚合，双向保留各自完整 traceIds；一次 expansion消除同事件重复边。
- **共享 selector 拥有规范化与接纳。** 首次仅对冻结 unit 的 kind/recordIds/traceIds own data、冻结 dense own-data string 数组及标准 iterator 证明成功后缓存 normalized unit 与 identity；命中仅核对继承 iterator仍为捕获的内建函数。getter、继承字段、索引 accessor、稀疏数组和 custom iterator继续按原 per-call快照消费。仅完整成功接纳后标记同一 normalized引用；BFS深度单调，后续同引用不会新增成员或改善深度。异方向和 traceIds union的新引用继续处理，blocked不记成功，原 units、排序与 unitIndex仍用于预算 frontier。
- **Index Runtime 拥有整批 filter 编译。** parse、normalize与semantic-validation成功后，每filter编译一次；any/none以actual查requested identity Set，all统计去重交集。完整索引解析、字段物化、集合validator、facets、total和排序保持原责任。
- **renderer 拥有固定切片反向索引。** source ID按UTF-16排序，同source保留原relation顺序；BFS仅扩展traceIds，context可显示，slice外target不展开。摘要JSON转义、缺省占位、层次与边界文本保持；JSON输出跳过renderer，仍使用事件优化后的同一查询结果。

两类反例决定复用边界：仅“unit与数组冻结”不能证明读取稳定，unit getter和数组索引getter都可改变目标；初版将应提升的b留在context，完整结果对照促成上述own-data及迭代证明。另一个合法预算反例为z归并b/p/q、a补充p，anchor=z、both、depth all、maxRecords4：若跨expansion删除已见事件，p-successors frontier会丢失z。当前仅跳过成功单位的循环body，保留完整remaining units，手写期待及旧生产对照均得到p的[a,z]与q的[z]。因此只比较traceIds不足以验收。

### 复杂度与输出成本

固定d事件的聚合、双向规范化与接纳为O(d log d)、额外O(d)，完整事件或blocked输出本身有Ω(d)成本；全图建图、边排序和其他事件仍存在。B的id-any membership为O(M+N)、额外O(M)，完整查询另有解析与命中排序。C含输出长度R的上界为O(A log A+L log A+T log T+R)、额外O(A+L+T)。这些结论针对对应热点，不将全部trace或真实输出视为常数／线性成本。

### 验证与适用边界

当前源码与生成CLI上重新执行2,797项完整旧／新对照：864组trace、864组终端文本、882组list、72组metadata/content search、108组scalar/reader，以及7条真实Node CLI的stdout/stderr/exit，全部相同。矩阵覆盖合法ordinary/split/merge组合、全部anchor、三方向、depth0/1/2/all、预算below/exact/above、context闭合／提升、筛选交集、分页、失败诊断和预算反例。七类动态adapter交叉三方向、三depth、三预算的189组完整对照也全部相同；全部输出及来源身份见附件。

公开原生套件实际通过：Index Runtime 62、shared graph 23、IR 305、Decision Records 282、Test Evidence 32、Novel Cards 38，均零失败。新增13个最小原生节点由Case承接，完整账本覆盖1208项，原入口保留。IR／Decision／Test Evidence runtime字节变化各只升版一次至64/74/36；Novel Cards公开sync/check确认生成字节未变，版本保持5。声明和Schema保持。Gate阶段、准确时点与执行／复用范围由 `verification.json` 区分；过程中的指标诊断与收敛动作保存在该附件，不作为新增质量规则。

原before的18组从保存的旧生产字节复跑，其中15个目标样本与原before完全相同，3个非法cycle样本仅核对历史观察。旧报告及资源保持原字节。优化范围限定于合法事件、exact批量membership和非JSON renderer；非法cycle位置查找与type-only依据去重保持原实现，完整来源验证、payload、CAS、锁与恢复保护保持。

本轮验证证明工作树源码和生成制品的对应行为；未执行提交、远端写入或release-only打包，也未证明分发／部署、其他平台／运行时或CPU／墙钟SLO。事件稳定性、BFS深度单调性、remaining frontier组成、scalar identity或slice渲染顺序改变时，应重新调查。

## 随附资源

- [adapter-snapshots.json](./_resources/261011-investigation-event-query-and-trace-rendering/adapter-snapshots.json)
- [adapter-snapshots.ts](./_resources/261011-investigation-event-query-and-trace-rendering/adapter-snapshots.ts)
- [after.json](./_resources/261011-investigation-event-query-and-trace-rendering/after.json)
- [before.json](./_resources/261011-investigation-event-query-and-trace-rendering/before.json)
- [measurement.ts](./_resources/261011-investigation-event-query-and-trace-rendering/measurement.ts)
- [verification.json](./_resources/261011-investigation-event-query-and-trace-rendering/verification.json)
