---
title: "Rust 与 TS 查询实现的算法复杂度差异"
id: "261105-rust-query-algorithmic-complexity"
formedAt: "2026-11-05T08:18:09Z"
question: "本次 Rust 查询原型是否改变了 TS 的算法或数据结构复杂度，哪些合法负载会放大差异，原有性能比较遗漏了什么？"
tags:
  - "algorithmic-complexity"
  - "decision-records"
  - "performance"
  - "rust"
relations:
  - type: "补充"
    target: "261105-rust-native-query-performance"
    summary: "以源码与计数区分整体收益中的算法差异"
---

## 形成时背景

前序性能调查测到直接 Rust CLI 在所选负载上明显快于 Node，尤其新进程启动及内容全扫描；npm 启动器的常驻调用却退化。用户追问差异是否只是每项常数较小、能否存在非恒定倍数的算法变化，以及小数据和固定成本是否会遮住变化。本篇只回答查询实现的工作量，保留前序配对计量作为不同问题的独立证据，不从时间倍数反推复杂度。

## 调查目的

在相同记录数、边数、文本与返回限制下，寻找可到达的不同阶工作；分别说明必要工作、局部算法、完整命令，以及常数和语言、实现、调用方式的归因边界。重点审计 list、metadata/content search、关系图校验和 trace；不修改生产或冻结候选。

## 调查范围与依据

- TS 为生产源码 `tools/decision-records/src/`、共同图和搜索实现 `tools/shared/src/`；Rust 为当时独立实验目录中的本轮候选源码；行为依据为 `tools/decision-records/README.md` 及当时的实验参数矩阵。此前配对测量的生产 revision 是 `098d64ad53ccfcd64c4d78b3a72782c0e2b6b6ae`，冻结二进制 SHA-256 为 `863e91862111f68e7a54505d14369a8d2afcdb2f37aac371f0a0f5099676e788`；本次计数用从该候选源码复制并插桩后另行离线编译的程序，**不是该冻结二进制的计数**。
- 有界输入为一个 archived 前序、d 个各以单条“修订”指向它的 active 后继，分别 d=8、16、32、64；每组先以生产 CLI `sync-index` 和 `check` 通过，再执行同一 `trace 260101-bench-00000 --direction successors --max-records 1 --json`。对 Rust 复制版的 unit 两两检查闭包计数，比较两程序的退出码及解析后的 JSON。无墙钟对比；结果、准确插桩 diff、原脚本、源码及程序指纹见资源。
- 使用 N 表示索引条数、E 表示关系边数、d 表示本次 anchor 的直接后继数、L 表示归一化前后可比较的文本长度、k 表示返回上限、M 表示命中数。以 ID 长度固定、通常映射实现和字符串比较成本可控为简化条件；输入包含可变长度字符串时应另计字符成本。平方规律是参数化算法及有限可行输入范围内的工作量结论，不宣称受 ID、字节和机器资源约束的实现存在严格无穷输入族。

资源记录一次实际执行，脚本和补丁供审阅当时的计数方法与结果，不是现行运行入口；实验源码不作为长期产物保留，留存材料不保证完整重跑。实验不涉及 npm 或生产源码写入。

## 调查结果与边界

### 有真实的非恒定工作量差异，但本次反例对 Rust 不利

Rust `src/trace.rs` 的 `units` 对每一普通边产生的 unit，都在现有 `units` 中 `.iter().any(...)` 查重（约第 218–283 行）；各普通边的成员不同，无法提前命中。先构造全部 unit，再在 `select` 中检查记录预算（约第 339–360 行），所以 `--max-records 1` 也不会避免这一阶段。上述合法星形图令此处恰做 d(d−1)/2 次 unit 比较：

| d | 检查次数 | sync/check | 双方 trace 退出码 | 解析后 JSON 相等 |
| --- | ---: | --- | --- | --- |
| 8 | 28 | 通过 | 0 / 0 | 是 |
| 16 | 120 | 通过 | 0 / 0 | 是 |
| 32 | 496 | 通过 | 0 / 0 | 是 |
| 64 | 2016 | 通过 | 0 / 0 | 是 |

这不是输出本身要求的二次工作：此调用的 frontier 包含 d 个后继，输出至少 Ω(d)。TS `tools/decision-records/src/records/decision-trace-admission.ts` 逐边生成普通 unit，`tools/shared/src/graph/trace-ordering.ts` 用 Map 按身份归并再排序；在此固定长度、不同普通边场景，归并的期望工作为 O(d)，排序一般上界 O(d log d)，没有对应的 d² 两两扫描。这里比较的是明确的 unit 构建阶段，不将其自动称作整个命令的时间复杂度：双方还须加载和验证全图、排序和输出。实验只证明这四个输入的实际计数与 JSON 等价，不能从插桩程序的时间推断冻结二进制速度。

Rust 还在 `units` 约第 235–243 行用 `.position` 线性查找事件；多个不同复杂事件时可能反复扫描事件表，尚未针对该路径做合法输入计数。TS 的事件按角色建映射并缓存；不要将这一静态候选当作本次已实测的另一个复杂度结论。

### 其他路径：约束、局部差异与未证实项

- **list 与 metadata**：两边加载并严格验证发布索引，筛选并排序候选；metadata 为精确 matched 数扫描全部候选，不能因为 k 小就停止。Rust `metadata_search.rs` 将 M 个命中引用存入 `found`，TS `decision-query-search-metadata.ts` 用 `collectRecordMetadataWindow` 仅保存 k 个投影；这是额外命中窗口 O(M) 对 O(k) 的空间差异，而双方先前均保存候选等结构，不能称完整查询空间分别为 O(M) 和 O(k)。精确零命中在无额外搜索索引时必须检查候选。
- **content**：两边都必须对实际扫描的文件读取、规范化并检查文本；未命中时不能仅因返回上限就早停，最坏需看全部允许扫描的文本。Rust `content_search.rs` 对命中行调用 `text_search.rs` 的 `ranges`，先枚举所有位置和范围、排序合并，再实施每文件 3 范围预览上限；TS `previews.ts` 与 `segment-matcher.ts` 先找命中行，再只物化到首个被省略的不相交范围。密集分离命中时局部物化数不同，但两者仍要处理全行规范化，不能据此声称固定查询长度下完整命令不同阶；可变长度查询的逐位置比较另有成本，未实测其复杂度或 Unicode 全组合。
- **查询词数**：Rust `text_search.rs` 的 `TextMatcher::new` 对每个词在已保存词中线性查重；Q 个互不相同的词导致 Q(Q−1)/2 次相等性检查，另计词长；TS `segment-matcher.ts` 使用 Set 去重，通常期望线性次集合操作。Rust `ranges` 还对每个 needle 的每个字符边界执行 `starts_with`，因此 query 词数及 needle 长度都影响工作上界；TS 的内建 `indexOf` 运行时算法不在本次证据中。两点是源码推导，未用查询词探针、输出差分或时间验证，也不是常见短查询的实测结论。
- **图校验**：Rust `graph.rs` 用入度队列进行无环检查；TS `shared/src/graph/relations.ts` 使用有访问状态的迭代 DFS，`decision-records/src/relations/relation-reallocation.ts` 按双向角色邻接做闭包。两者均非对每个节点重新遍历全图的朴素方案。Rust 使用 BTreeMap/BTreeSet 与部分 HashMap/HashSet，TS 使用 Map/Set 并对边或邻接排序；有不同的查找和排序成本，但本轮未证明 Rust 消除了 TS 合法输入上的某个 O(N²) 校验，也不能认为两者全图处理相同。非法多错误 Rust 首错、TS 聚合，本来不是等价任务。
- **选择器与共同成本**：完整 dated ID 在 Rust BTreeMap 查询、TS 对象按键查找；名称则都可能扫描集合以发现歧义。即便某一查找较优，命令每次读取和验证完整索引的工作仍不可忽略。输出、排序、解析、文件系统、安全检查与进程启动都可能主导不同规模；单次查询需要读取的索引字节本身给出相应线性输入下界。

对于前序无边的 page、metadata-zero、content-zero 基准，本轮**未证实 Rust 相对 TS 存在更优的增长阶**；这不是证明绝不存在，基准倍数也不能给出阶数。

后续版本已移除本报告定位的 unit 尾部查重，修复证据和有关系图的三臂计量见[独立调查](./261105-rust-trace-aligned-graph-performance.md)。本文保留优化前实现的计数和推理；其他静态候选不因这次局部修复自动消除。

因此，**不应把本次加速说成只有 Rust 语言常数优势，也未证明 Rust 普遍存在更优的大 O**。程序、容器、数据、调用与运行时同时不同；固定启动成本可以掩盖增长差异，系数小也可以推迟交叉点，但前序独立单元的耗时不能分解为这些原因，也未测试本报告星形图的时延交叉点。要决定优化优先级，应针对真实度分布、返回范围和候选算法，先保证行为等价，再预登记规模并在独占窗口配对测量。上面复杂度差异属于当时的实现，可以在任一语言中改写，并非 Rust 或 TS 的固有定理。

## 随附资源

- [本次执行的原始生成与比较脚本](./_resources/261105-rust-query-algorithmic-complexity/probe.py)
- [工具、源码与插桩二进制指纹](./_resources/261105-rust-query-algorithmic-complexity/provenance.txt)
- [四组计数与输出比较原始结果](./_resources/261105-rust-query-algorithmic-complexity/results.jsonl)
- [隔离源码计数插桩补丁](./_resources/261105-rust-query-algorithmic-complexity/trace-count.patch)
