---
title: "决策与调查工具剩余常数成本：重复获取、解析、校验与遍历"
id: "261021-decision-investigation-constant-factor-audit"
formedAt: "2026-10-21T02:20:18Z"
question: "保持现有 Markdown 与 JSON 架构及安全语义时，决策和调查工具中哪些重复工作值得用低复杂度方式消除？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "skill-tooling"
relations: []
---

## 形成时背景

同一项目中的调查报告涵盖数据分析、视频转译、机制研究、Bug 排查与前沿探索，日增约 10–30 份，资料密集时可能达到 200 份。用户选择保留 Markdown 权威来源、JSON 派生索引和现有 CLI，优先评估低复杂度的重复工作消除。

短元数据合成查询大致随规模增长，仍需核对真实命令是否重复获取和处理全集。本轮据当前源码区分必要的全量工作、同阶段重复工作与内部循环放大。相关背景见[决策查询与阶段成本](./decision-snapshot-stage-and-event-costs.md)、[决策批量定位](./decision-batch-lookup-and-stable-event-members.md)、[调查局部暂存](./investigation-local-stage-and-single-read-check.md)及[关系查询](./investigation-event-query-and-trace-rendering.md)；本轮测量独立解释当前版本。

## 调查目的

定位重复读取、解析、验证、字段物化与遍历，按收益、改动范围和验证负担选择实施顺序。交付每项候选的调用链、计数依据、最小改法及保护边界；本轮产物是调查结论，生产优化留待后续实施。阅读时先看[结论与实施顺序](#结论与实施顺序)，再按候选编号展开证据。

## 调查范围与依据

### 基线与样本

形成时基线为 Git `d5f9fde2821f03088a2a1850a3c2819b23224db5`，日期为 2026-10-21。运行时为 Node `v26.8.2`、Bun `1.4.2`；Decision Records version `80`、Investigation Report version `69`。当时正式集合含 388 条决策、64 份调查。[源码清单](./_resources/261021-decision-investigation-constant-factor-audit/source-manifest.json)保存 293 份生产源码及两个生成 CLI 入口的 SHA-256。

| 对象 | 样本与覆盖 |
| --- | --- |
| 决策工具 | N=12／120 份正式决策、C=3 份候选，非 Git 隔离目录；覆盖扫描、检查、候选、查询、同步预检及维护准备。另以 N=1,000／1,001 的合法纯发布索引验证真实查询入口。 |
| 调查工具 | N=20／200 份正式报告、C=3 份候选及星型复查关系。资源样本含 R=N+C 份资源，并有候选共享正式 owner 资源；另含无资源、非 Git 样本。隔离 Git 仓库只初始化。19 对条件覆盖检查、关系查询、正文搜索、发布准备、关系预检及选择性同步。 |
| 共享查询与搜索 | 无 overlay 的不可变索引 N=1,000／1,001／5,000／10,000；中英文命中及零命中片段、5,000 行正文，以及真实 64 份报告的列表与元数据查询。 |

N 表示正式记录数，C 表示候选数，F=N+C。决策和调查文件分别位于 `tools/decision-records/src/`、`tools/investigation-report/src/`；共享实现位于 `tools/index-runtime/src/` 和 `tools/shared/src/file-text-search/`。

### 计量与证据强度

- 文件与原语 wrapper 保留原返回值和异常，按路径类别与调用栈归类。JSON.parse 总数含 YAML scalar 处理，只有完整索引调用栈才记作“完整 JSON 解析”；正文匹配的 `FileHandle.read` 单独解释。
- 共享与调查脚本通过 Node `registerHooks` 在内存插入入口计数；共享 case 使用独立进程。决策观测使用 fs／JSON 调用及同步函数 coverage，排除可能把 async 恢复执行算作调用的计数。
- 调查局部探针只调整内存中的三处数据复用：current 包装层返回、关系投影和完整 layout 的身份返回。19 对条件全部成功，其中 17 个公开结果的规范化语义 hash 相同，两个内部 preparation 对象不比较。便携脚本重跑 19 个基线条件，计数一致。
- 独立审查者重跑共享 10 个 case，结果和源码指纹均与附件一致。计数证明工作量及重复位置；实际时延、内存收益和完整失败矩阵仍需在候选实现后验证。

## 调查结果与边界

### 结论与实施顺序

**优先让后续步骤消费同阶段已有结果，保持现有架构和验证职责。** 已确认 11 项候选；其中 `reader.all()` 的重复分页处理会随页数放大，超出了固定常数成本，但仍可先从领域查询路径局部解决。

| ID | 优化对象 | 最小方向 | 次序 |
| --- | --- | --- | --- |
| C1 | 决策同字节 YAML 与身份解析 | 传递扫描身份，合并来源发现中的 ID／候选状态解析 | 首批 |
| C2 | 决策查询的 reader 构造与全集分页 | 领域投影直接消费严格加载的快照 | 首批 |
| C3 | 调查 current 索引的序列化／解析往返 | 复用共享加载器的成功结果 | 首批 |
| C4 | 调查列表的重复规范化与完整校验 | 在受控内部边界查询已验证快照 | 边界足够简单后纳入 |
| C5 | 调查列表的双重关系投影 | 一次 Map 同时提供匹配 ID 与关系依据 | 首批 |
| C6 | 决策检查／同步的中间全集重读 | 首轮 scan 派生本阶段 snapshot | 阶段数据流优化 |
| C7 | 调查发布 selector 与首轮 prepare 的重复发现 | 同阶段传递 layout | 阶段数据流优化 |
| C8 | 已有完整正式身份时仍加载调查索引 | 完整非空 layout 直接提供身份 | 首批 |
| C9 | 零命中与元数据查询仍生成字符范围 | 先判定命中，再按需映射原始范围 | 完成 Unicode 对照后评估 |
| C10 | 同一正文重复分行 | 单文件匹配与预览共用 lines | 相邻小改动 |
| C11 | 决策候选关系／摘要逐项全扫 | 复用已有批量 lookup | 批量关系场景优先 |

首批为 C1、C2、C3、C5、C8；C4 的收益取决于内部接口是否能保持简单。以下计数是基线事实，探针变化和静态预期分别标明。

### C1：决策扫描与来源发现复用解析结果

`scan-collection.ts:validateSourceMembership` 提取正文 ID，`scan-records.ts:scanReadableSourceFile` 再提取一次，随后 `body-validation.ts:validateDecisionBody` 调用 `decision-metadata.ts:parseDecisionMarkdown` 完整解析。三步均进入 YAML parser。

| 正式／候选数 | scan 正文读取 | YAML 解析 |
| --- | ---: | ---: |
| 12／3 | 15 | 45 |
| 120／3 | 123 | 369 |

先在 `SourceFile` 中保存与 `sourceText` 对应的身份结果，预计可把扫描解析从每份 3 次降为 2 次。保存 `null` 能区分已解析失败与尚未解析；完整 frontmatter 复用可作为后续取舍。

另一局部重复位于 `decision-index-source.ts:51-53,100`：发现 ID 后，`isCandidateDecisionMarkdown` 又解析同一 YAML。check／sync 预检的 snapshot 构建和结束 revision 守卫均经过此链，候选状态解析共 2F 次。每轮发现同时取得 `{decisionId,isCandidate}` 即可去重，轮次间仍独立取源。两处改法均须保留 YAML 语义、重复身份、候选排除和错误顺序。

### C2：决策查询直接消费发布快照

`decision-query-context.ts:44-74` 严格加载索引后重新构造 reader，再次规范化、验证并物化字段。list 经 `reader.all(id asc)` 取全体，最后才由 `projectDecisionList` 筛选并按 createdAt 降序／ID 升序排序；trace 也通过 all 构图。

共享 `reader.ts:169-191` 的 all 每页最多 1,000 条，每页重新 query 全集并排序。无筛选、无 overlay 的计数为：

| N | query／排序轮数 | 筛选访问元素总数 | 排序输入元素总数 |
| --- | ---: | ---: | ---: |
| 1,000 | 1 | 1,000 | 1,000 |
| 1,001 | 2 | 2,002 | 2,002 |
| 5,000 | 5 | 25,000 | 25,000 |
| 10,000 | 10 | 100,000 | 100,000 |

稳定输入、命中 M 条时，轮数为 `P=max(1,ceil(M/1000))`。排序输入数是每轮元素数之和，不是比较次数。真实决策索引在 N=1,000／1,001 时，list 和 ID trace 分别执行 1／2 轮，名称 trace 为 2／3 轮，均读取一次 JSON、零次 Markdown。

优先参照现有 metadata 查询，让 list 的 `projectDecisionList(entries,...)` 和 trace 直接消费严格加载的快照，并保留确定性排序、名称歧义、facets 与关系依据。这样可局部消除 reader 重建、分页及 list 的前置 ID 排序。

共享 all 的动态输入另有契约：每页可能重新访问 `filters`、`sort` 和 `runtimeStates` getter；1,001 条加动态 overlay 的复核中，getter 被访问两次。若调整共享层，应保持该行为或单独明确新契约，同时保留公共 `query.limit≤1000`。

### C3：调查 current 包装层复用成功结果

`investigation-state-index.ts:48-74` 在 `loadCurrentStateIndex` 成功后，仍执行 `serializeStateIndex→parseStateIndex`。共享层此时已检查来源 revision、结构、state、查询字段及集合契约。

直接返回共享层结果的探针，使 current content search 少一次完整 JSON 解析；N=20／200 时 Date.parse 从 100／1,000 次降为 60／600 次。全集当前性核对和正文搜索照常执行，此项收益来自内存往返去重。

### C4：调查列表复用严格加载的快照

`query-index.ts:queryLoadedInvestigationIndex` 收到合法索引后，经 `runIndexQuery→queryStateIndex→prepareStrictIndex` 再完整处理一次。真实 64 条集合、limit=1 时，normalize 为 2 次、state projection 为 128 次、字段物化为 192 次、完整校验入口为 2 次。

3N 次字段物化分别来自加载投影、再次严格投影和查询物化。仅消除第二次 strict prepare 的理论边界是 **字段物化 3N→2N、normalize／完整校验 2→1**。内部路径可参考已有 fromSnapshot 机制，绑定准确 definition、不可变快照与诊断路径；公共 parse／load／query／find 继续验证任意输入。快照的冻结状态或版本字段本身不证明它已通过领域验证。

### C5：调查关系列表只生成一次投影

`query-index.ts:155-164` 先调用 `relatedInvestigationIds`，其内部生成 `filterRelationsByEntry` Map，外层又生成一次。Map 的 keys 已能提供匹配 ID。

N=20／200 的关系 list 探针将投影从 2 次降为 1 次，公开结果相同。实现须同时保持方向、type-only、同边筛选、歧义、去重、排序、空结果、total 和分页。

### C6：决策检查／同步复用首轮 scan

N=12、C=3 时，check 和 sync 预检均读取 45 份 Markdown，分属三个阶段：

1. scan 读取 15 份，验证身份与文档。
2. `validateDecisionIndexText→syncDecisionIndex(check)→buildStateIndex→readDecisionStateSnapshot` 再读取 15 份，构建快照。
3. `syncStateIndex→readSourceRevision→readDecisionSourceRevision` 再读取 15 份，检查构建期间漂移。

优化目标是让第 2 阶段消费第 1 阶段已验证的字节与文档，保留第 3 阶段的独立 revision 获取，以及当前索引、普通文件、完整投影和诊断检查。Decision 的 check 与 Investigation 的首次采集 check 各有契约，应分别验收。

更小的纯计算项位于 `decision-query-sync.ts:108-124`：取得 validation context 后又以 `source-only` 验证同一扫描。首次调用即选择正确的 `scanErrorPolicy` 并复用结果，可少一次 summary／selection 汇总；坏索引的恢复语义与 warning 集合须一致。

### C7：调查发布复用 selector 阶段的 layout

`publish-selector.ts:13` 完整发现集合后，`publish-preparation.ts:93` 的首轮 prepare 再次发现。N=20／200、C=3 的公开预检中，正式来源读取 60／600 次、候选读取 9 次，另读索引 2 次，总 readFile 为 **71／611 次**。

单独调用 prepare 为 48／408 次，差值恰为 N+C=23／203。该对照定位了 selector 的重复发现；同阶段传递 layout 可静态省去这部分读取。正式执行的 `protectedPreparation`、freshness、最终关系／资源 gate 及锁内复核继续独立取得所需事实。

### C8：完整 layout 直接提供正式身份

`candidate-document.ts:158` 的 `candidateFormalIdentity` 已有完整非空 `formalSources`，仍先加载严格索引，最终只返回 `layout.reportIds`。

提前返回的探针每次 preparation 少一次 index read、一次完整 JSON 解析和 2N 次 Date.parse。该分支仅适用于已有足够正式身份事实的 layout；空／局部 layout、未知 owner、移动身份及发现 fallback 维持原职责。实现时需对照原有失败诊断和 warning。

### C9：命中判定与原始字符范围映射分开

`segment-matcher.ts:75-141` 对每个片段先执行 `normalizeSegment`，构建 grapheme 到原始 UTF-16 位置的 spans，再判断命中。metadata 查询只消费字段／关系身份；零命中正文也已承担映射成本。

| 中英文混合样本 | 片段数 | 原始 UTF-16 单元 | grapheme 映射 | 命中片段 |
| --- | ---: | ---: | ---: | ---: |
| 零命中 | 1,000 | 105,000 | 105,000 | 0 |
| 零命中 | 10,000 | 1,050,000 | 1,050,000 | 0 |
| 命中 | 1,000 | 105,000 | 105,000 | 1,000 |

真实 64 份报告的零命中 metadata 查询仍规范化 528 个片段、映射 14,836 个 grapheme。可先用等价规范化文本识别命中，metadata 只返回身份，正文按需映射范围。

此项验证负担高于简单复用：需保持 NFKC、上下文大小写、Unicode 空白折叠、组合／展开字符、原始 UTF-16 range、all 跨片段与 phrase 单片段语义，并核对 `String.trim` 与现有尾部处理的差异。当前证据确认了映射成本，新快路径仍待实现与对照。

### C10：匹配与预览共用分行结果

`previews.ts:findLineMatches` 与 `record-search.ts:recordPreviews` 对同一正文分别调用 `splitPhysicalLines`。5,000 行、128,890 个 UTF-16 单元的样本分行两次，累计处理 257,780 个单元，最终展示三个命中范围及一个上下文行。

在单文件处理阶段传递 lines 即可去重，保持 CRLF／CR／LF、末尾换行、命中计数、预览截断与错误行为。

### C11：决策候选关系与摘要共用 lookup

`decision-candidate-service.ts:119-139,180-199` 对 relations 与 relationSummaries 分别 resolve，每个 name 重新 filter 全部 `scan.records`，目标存在性还逐项 some。N=120、C=3、4 个关系及 4 个摘要时，resolver 为 8 次，filter 访问 984 次（8×123），目标 some 访问 474 次。

可在本阶段复用已有 `createDecisionRecordLookup` 和惰性 `createDecisionNameLookup`，保留完整 ID 匹配、名称歧义、重复身份、关系／摘要绑定及错误顺序。

### 次要候选与保护边界

两项局部派生值可在相关切面一并评估：

- **图内日期。** `relation-validation.ts:245-246` 每边重算两端日期。星型 E=19／199 时，每轮 Date.parse 为 38／398 次；图验证内部按 ID 保存 timestamp（包括 null）可减少重复，但 Map 成本与小图收益需权衡。
- **旧正文解析。** `validation-collection.ts:collectionStates` 已解析正式正文，`relation-transaction-candidate.ts:181` 又解析选中旧 text，再解析 nextText。K=1 时 parseReport 为 N+C+2；保留本阶段旧 parsed 可省 K 次，需权衡对象传递成本，修改后正文仍完整解析。

后续实施统一保留以下职责：

| 边界 | 保留的事实与行为 |
| --- | --- |
| 当前性与查询 | current 搜索核对全集 revision；任意输入经过公共严格入口；查询结果保持集合、顺序、total、分页、facets、关系依据、来源声明及诊断。 |
| 阶段复核 | 同步结束 revision、正式执行的保护性 prepare、路径身份及 HEAD／pending CAS 独立核对可变事实。 |
| 资源安全 | 各 gate 继续验证 Git 可见性、ignore、root／owner 身份和成员。带资源 publish prepare 的资源根准备为 3 次、资源 open 为 75／615 次、目录 readdir 为 72／612 次；复用前需明确各 gate 的责任差异。 |
| 维护范围 | 以局部参数交接、现有 lookup 和查询投影为首选；查询及计数语义、回滚与 scope／outcome 作为验收条件。 |

### 验证结果与适用范围

调查产物为本报告、八份证据和派生索引，生产实现保持形成时基线。调查阶段已完成三个原生工具套件、源码／生成入口一致性及报告全集检查；`bun run check` 为 61 项通过、0 失败、3 项发布专用检查不适用，详见[形成时验证记录](./_resources/261021-decision-investigation-constant-factor-audit/verification.json)。

候选实施后应先对照完整查询结果和失败诊断，再检查来源／索引／资源／HEAD／pending 漂移及恢复行为；matcher 另需 Unicode 和跨片段对照。真实加速比与内存收益应在无计数 hook 的相同输入上重复测量。

本轮结论适用于所列源码和样本，未覆盖用户真实项目、其他平台、任意并发竞态、巨大附件或关系密图。源码指纹或领域契约变化后，应重核对应调用链。

## 随附资源

- [Decision 隔离调用计数](./_resources/261021-decision-investigation-constant-factor-audit/decision-counts.json)
- [Decision 形成时观测脚本](./_resources/261021-decision-investigation-constant-factor-audit/decision-probe.mjs)
- [Investigation 基线与局部探针观测](./_resources/261021-decision-investigation-constant-factor-audit/investigation-counts.json)
- [Investigation 形成时观测脚本](./_resources/261021-decision-investigation-constant-factor-audit/investigation-probe.mjs)
- [共享查询与匹配计数](./_resources/261021-decision-investigation-constant-factor-audit/shared-counts.json)
- [共享查询与匹配观测脚本](./_resources/261021-decision-investigation-constant-factor-audit/shared-probe.mjs)
- [形成时源码与生成入口指纹](./_resources/261021-decision-investigation-constant-factor-audit/source-manifest.json)
- [形成时验证结果](./_resources/261021-decision-investigation-constant-factor-audit/verification.json)
