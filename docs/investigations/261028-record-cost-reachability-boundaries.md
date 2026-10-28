---
title: "剩余集合成本候选的合法可达性与安全优化边界"
id: "261028-record-cost-reachability-boundaries"
formedAt: "2026-10-28T06:00:52Z"
question: "新基线中的剩余集合成本候选能否由合法领域入口触发，哪些可消冗余，哪些仍承担结果或拒绝语义？"
tags:
  - "decision-records"
  - "index-runtime"
  - "investigation-report"
  - "performance"
  - "root-cause-analysis"
relations:
  - type: "复查"
    target: "261028-collection-single-item-cost-audit"
    summary: "在新基线验证剩余候选的合法可达性与等价边界"
---

## 形成时背景

[集合成本审计](261028-collection-single-item-cost-audit.md)在 `696b888b` 记录了重复工作与尚待证明的候选；其局部闭包成功并不证明完整合法 evolve，任意公共图构造也不证明两领域 trace 可达。本轮固定到 `eea1d03e3429f83797e660d75326e0ebd752f61d`，重新检查五组剩余候选。新旧版本及探针不同，计数不拼接为同一次测量，也不以本轮证据改写旧报告形成时边界。

## 调查目的

判断固定字段 subtree 检查、单超长命中行范围生成、selected 全状态比较、读取阶段叶节点重复 lstat，以及决策重划闭包和复杂 trace 排序，分别属于可消冗余、必要契约还是尚未证明的优化；为后续方案提供实际 consumer、反例与合法入口证据，不评价实施进度。

## 调查范围与依据

源码与 owner 包括 Index Runtime、File Text Search、Decision Records 关系及生命周期契约。CodeGraph 用于调用定位，限定路径源码确认其结果。测量从固定 commit 的 `git archive` 隔离副本加载，复用既有依赖；Node v26.8.2、Bun 1.4.4、Git 2.53.0，Linux。完整版本与关键源码 SHA-256 见 `provenance.json`。

- **真实文件系统及源码 CLI**：隔离、非 Git 文件夹生成合法 Markdown，经 `runDecisionRecordsCli` 完成 `sync-index → evolve → check` 或 `sync-index → check → trace`。仅在副本中加入闭包成员查询及序列比较计数；trace 输出再与未计数基线严格比较，evolve 后以未计数基线 check 验收。这里没有 Git fixture 写入、真实 Node CLI 子进程、打包制品或 Git 事务测量。
- **隔离原型差分**：query-fields 的同调用 memo；selected 的 revision 差异先短路与过滤后排序；长行的按起点归并游标。均未写入生产源码。query-fields 使用真实两域 definition 和有限 JSON 状态构造，未把该直接函数输入称为完整领域事务。长行保留现有 Unicode 映射，验证范围限制变化，不独立验证映射本身。
- **受控真实 FS 调度**：在 `readSelectedFile` 使用的 fs 调用返回边界实施真实 rename、symlink 与恢复，比较当前实现和仅合并叶节点 lstat 的副本。包装器控制时点，不虚构 Stats 或读取字节。

`domain-evidence.json` 保留最小完整 CLI 响应和规模响应的明确节选；完整响应由脚本重跑生成。参数、固定随机种子及 fixture 输入生成均在四份探针中。`reproduce.sh` 从指定基线创建新临时目录，不安装、不访问远端；归档时方法经过格式整理与插桩点断言增强，复跑摘要及方法指纹见 `method-provenance.json`，原始结果不改。

## 调查结果与边界

### 合法入口补齐两项可达性

**重划闭包的乘积扫描确实可由完整合法 evolve 触发。** 先建立 M 个独立合法重划组件，每个有两个已归档前序、两个活动后继；再准备一个排序靠后的新事件，选择 K 个候选后继，归档其两个活动前序。各次 sync、evolve、写后 check 均成功。`hasSelectedSuccessor` 对不相交旧组件逐一遍历 K 个选择，再命中新组件；M/K 为 5/4、20/20、40/40 时计数分别为 21、401、1601，即该输入的 M×K+1。优化可保留组件顺序而改查较小集合，或建立同阶段成员定位；首命中组件和闭包诊断仍需回归证明。这里的“合法”指工具格式、领域图及完整事务验收，不声称自动证明 Markdown 决策的真实业务语义。

**不同复杂 trace 事件可以具有长共同 ID 前缀。** 合法构造为：归档 anchor；P 个归档 common 以普通替代边指向 anchor；M 个活动 merge 后继分别归并 anchor 与全部 common。从 anchor 沿 successors、depth=1 查询时，各 merge 单元的 traceIds 都包含共同 common，末尾为各自后继。P=M 为 4、20、40 时，观察到的最大相等前缀长度分别为 4、20、40，序列元素比较分别为 31、979、1659。所有 sync、check、trace 成功，计数版与未修改版 JSON 完全一致；trace 的 depth 截断按原结果保留，并非全深度完整性证明。

这些计数证明当前领域可达的工作机制，不证明其现实频率或端到端瓶颈。排序比较次数受输入顺序与运行时排序算法影响，不能仅由三个计数宣称总耗时二次增长；该 fixture 本身包含 M×P 条归并边，排序优化须相对必要图输入成本评估。

### 可优化候选与必须保留的工作

| 候选 | 动态证据 | 结论与边界 |
| --- | --- | --- |
| query-fields subtree 重验 | 两域固定四字段、1,000 条关系的直接物化：Object.values 次数 DR 4005→1002，IR 5005→2002；七组缺失、容器、each、终值及时间错误/成功结果精确一致。 | 同调用复用有价值；实际 projection 先创建独立 data-only frozen clone。只看 Object.freeze 不足：冻结 getter 对象两次 isJsonObject 可依次 true/false。必须绑定内部可信来源，不能向任意公开输入承诺等价。 |
| 单超长行范围 | max=1 时，10,000 个分离全角命中当前构造 10,000 个 occurrence；按起点合并游标只需生成两项便可保留首范围并证明截断。12,879 组确定性 Unicode、all/any/phrase、limit=1/2/3 差分一致。 | 可在 content 限量入口按最终合并范围提前结束，不按原始命中数粗截。连续 10,000 个 a 查询 aa 必须处理 9,999 次重叠，才能得到 [0,10000] 和 truncated=false。跨行 all 仍须先确认全部 term。原型未覆盖 abort/异常时序、整段预览裁剪接线；normalizeSegment 仍处理完整行，不承诺总内存或时间只随显示上限增长。 |
| selected 全状态比较 | N=100，revision 差异数为 0/1/100 时，先判 revision 的 stringify 次数由 202 分别变为 202/200/2；返回一致。真实 selected preview 中，仅改未选 b 的合法 state、保留原 fingerprint，会以 unselected-changes 拒绝。 | revision 已不同即可判 changed；可仅排序 changedIds。revision 相等不能代替 state 比较，更不能省未选保护。独立 baseline/candidate 解析没有提供可直接利用的共享 state identity；本轮不引入跨阶段 provenance 缓存。 |
| 叶节点重复 lstat | 单叶稳定读取当前五次，简单合并副本三次；打开后真实替换仍被两版拒绝。但下述瞬时符号链接调度使原版拒绝、副本成功。 | 不能声称简单合并保留相同瞬时替换拒绝语义。当前拒绝边界保留；是否重定义边界或用等价句柄身份方案，须另行设计。 |

叶节点反例的精确时序是：首次 `lstat(leaf.txt)` 已获得原文件 Stats 后，将原文件 rename 到旁路名，并让 leaf 成为指向**同根内 other.txt** 的符号链接；原版第二次 lstat 看到符号链接，以 `invalid-file: only accepts ordinary files` 拒绝。合并版进入 realpath，解析到同根 other 后，包装器在 realpath 返回前删除符号链接并把原文件改回 leaf；随后 O_NOFOLLOW 打开原文件，最终返回 `original`。**没有读到 other 的字节，也没有证明任何越界读取。** 这是拒绝结果差异，不是已发现的生产漏洞；另一个在 open 完成后替换目标的场景，两版都以 opened identity changed 拒绝。

### 未覆盖与建议边界

本轮不包含生产修复、完整仓库门禁、Git pending/锁/恢复、Windows、冷缓存、容量上限或真实业务分布时延。query-fields 和 selected 原型只给出窄化的等价路径，不能替代全部公开输入与故障矩阵；trace 原型尚未提出经验证的替代排序。优先评估闭包较小集合查询和 content 按最终范围停止；selected 的保守短路与 query-fields 的同调用可信复用可作为独立小改动。文件身份检查与未选保护不以性能为理由移除。

## 随附资源

- [复跑前置、临时输出与清理边界](./_resources/261028-record-cost-reachability-boundaries/README.md)
- [合法领域 CLI 的计数与响应节选](./_resources/261028-record-cost-reachability-boundaries/domain-evidence.json)
- [叶节点真实替换实验结果](./_resources/261028-record-cost-reachability-boundaries/files-results.json)
- [基线副本的计数插入差异](./_resources/261028-record-cost-reachability-boundaries/instrumentation.diff)
- [长行有限范围差分结果](./_resources/261028-record-cost-reachability-boundaries/longline-results.json)
- [归档方法指纹及复跑摘要](./_resources/261028-record-cost-reachability-boundaries/method-provenance.json)
- [合法领域输入生成与 CLI 探针](./_resources/261028-record-cost-reachability-boundaries/probe-domain.mjs)
- [文件身份调度与合并反例探针](./_resources/261028-record-cost-reachability-boundaries/probe-files.mjs)
- [有序命中游标与确定性 Unicode 差分探针](./_resources/261028-record-cost-reachability-boundaries/probe-longline.mjs)
- [字段复用、selected 与长行基线探针](./_resources/261028-record-cost-reachability-boundaries/probe-small.mjs)
- [版本、环境与基线源码指纹](./_resources/261028-record-cost-reachability-boundaries/provenance.json)
- [隔离重跑入口](./_resources/261028-record-cost-reachability-boundaries/reproduce.sh)
- [计数副本准备脚本](./_resources/261028-record-cost-reachability-boundaries/setup-instrumentation.py)
- [字段、selected 与长行基线结果](./_resources/261028-record-cost-reachability-boundaries/small-results.json)
