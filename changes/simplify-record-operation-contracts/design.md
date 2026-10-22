# Design

以发布基线支持局部操作，将全集来源验收交给显式检查／同步；独立暂存采用“选中即刷新”。本文定义实施目标，实际进度由 tasks 记录，生效规则由各领域 owner 维护。

## Context

- 领域与 CLI 入口见 [proposal 的 owner 表](proposal.md#affected-owners)。
- Markdown 是内容事实源；**发布基线**是本次读取且通过结构与领域图验证的持久索引，只证明发布投影有效。**pending** 是 Git 暂存状态，与 HEAD 和工作区分别处理。
- 代表负载为一万条正式存量，候选、关系输入和资源数量保持常数；历史调查提供问题依据，优化收益由本 Change 的对照测量证明。

## Goals / Non-Goals

目标：

- 让起草、搜索、普通维护与暂存只承担声明范围内的必要工作。
- 保留全集验收入口、独立暂存、领域约束和事务保护。
- 用代表负载核对结果、保证变化与成本。

范围边界：

- 沿用现有架构和持久索引格式，以调用内复用和现有组合机制实现；不新增跨调用缓存或状态体系。
- metadata 查询窗口、精确计数、list facets、trace 及身份更正能力保持现有契约。
- 删除、资源 owner 删除、身份更正及含这些动作的组合事务保持现有严格安全边界；Git 历史确认继续依据固定 HEAD 的真实来源，不以 HEAD 索引代替来源存在性证据。

## Decisions

### Intended Change

#### S1：起草与候选读取

- `new` 取得一次身份／时间，核对自身参数、结构、安全路径和不覆盖条件后创建草稿；去掉回显的发布级辅助预检。
- 从已有发布信息可便宜且可靠地判断的冲突就地反馈，其余全局身份与关系冲突交给 publish 门禁。
- `show-candidate` 检查所选候选及直接必需的资源／owner 依赖，readiness 表达实际覆盖。
- `candidates` 保留成员发现与安全检查。同目录身份发现仍可能有集合级成本。

#### S2：普通维护沿用发布基线

覆盖普通 publish、evolve、mark-aligned、archive、reactivate 和 set-relations；高风险组合按上述范围边界处理。

1. 严格读取发布基线，保留完整字段、关系与资源 owner 声明校验。
2. 从发布图计算写入对象、直接前后序、所涉完整演进事件及必要资源 owner 依赖；读取这些来源，核对身份、状态、位置、投影和发布指纹。
3. 将本次变化应用到发布图与索引，验证最终领域约束；循环与事件闭合按需要遍历完整发布图。
4. 锁内复核相关可变来源和索引，按现有事务责任写入，保留恢复与结果诊断；其余来源沿用发布投影。

领域准备函数消费已验证投影与所选来源，阶段内复用解析结果；保持清楚的验证状态，不以伪造全量 scan 或清空错误绕过检查。显式全量 check／sync 的来源读取责任保持独立。

未读取正文的当前健康、未同步全局身份变化和手改关系由显式检查／同步发现。调用者已知有正式来源手改时先同步；选中对象或必要依赖漂移仍阻断写入。`sync-index --select` 保持“全部变化必须显式选中”的语义。

初始化与恢复采用以下固定分流：

| 状态 | 路径 |
| --- | --- |
| 有合法空索引 | 作为空发布基线进入普通操作 |
| 索引不存在，首次 publish | 沿用首次建立分支，确认正式集合确实为空，再建立所选候选与索引；该分支允许完整身份发现 |
| 已有正式来源而索引缺失，或索引损坏／版本不兼容 | 明确失败；恢复来源后显式全量 sync-index，再按任务需要验收 |
| 起草或只读搜索缺索引 | 起草按 S1 处理；搜索明确恢复，不借用首次发布分支重建来源 |

#### S3：发布范围内搜索当前文本

- 严格加载发布索引并验证领域图，按状态、tags、关系与路径选择文件，再匹配当前字节；省去匹配前的全集正文与资源语义验证。
- 未同步新文件和筛选字段变化在同步后进入范围。候选数超过原生硬限时，在读取正文前拒绝；预算诊断优先于无关来源语义错误。
- 搜索记录入口在每次安全读取后、匹配前调用领域身份验证器，使用同份文本核对 ID。只核对必要身份，不额外要求正文或其他 metadata 全面就绪；已扫描的非命中文件同样验证。
- 必需文件读取失败、身份不匹配、路径安全错误和取消均准确失败。匹配、预算、排序、计数精度与截断覆盖保持现状。
- 索引不可用时明确失败并指向检查／同步，以显式恢复替代隐式来源重建。

content 的公开来源固定为：

```json
{"kind":"published-index+current-text","currentness":"unchecked","fallback":false}
```

kind 表达“发布范围＋本次读到的文本”，currentness 表达未验证全集来源新鲜度；文本不构成跨文件原子快照。metadata 继续使用 published-index／unchecked／false。

保持既有 source 字段形状，调整共享 `RecordSearchSource`、Investigation runtime／手写 API 声明及相应生成声明；六行摘要继续渲染同一结果。记录检索的内部身份验证器为可选参数，普通文件检索及未配置的调用保持原契约。

#### S4：按交付目标调用外层验收

- 普通动作在输入、影响与授权明确后直接执行，保留调用内部的写前校验、漂移保护和恢复。
- 独立 `--preflight` 用于写前审阅预计影响；复杂演进、删除与身份更正按风险保留必要审阅。
- 起草、只读和普通局部交付省去默认附加的全量检查，按实际覆盖报告结果。
- 需要当前全集健康结论的任务，在维护批次验收时执行全量 check，单条任务同样适用；批次沿用现有调用方式。

调用者按下表同步：

| 调用位置 | 验收安排 |
| --- | --- |
| 两域 SKILL、CLI 操作契约与恢复手册 | 普通路径按实际覆盖交付；手工正式编辑先同步，异常走明确恢复 |
| 记录维护公共流程及两份领域流程 | `scope.allEstablished=true` 或明确要求全集健康时保留基线检查与批末全量验收；其余按所选范围审查和交付 |
| 项目质量与交付门禁 | 保留 AGENTS 要求的项目检查，S4 仅收缩领域操作的默认外层重复动作 |

#### S5：选中即刷新，未选保持

保留 `stage <ID...> --scope index|domain|all`，按明确选择组合本次捕获的 pending 与工作区版本。

| scope | 刷新内容 | 保持内容 |
| --- | --- | --- |
| `index` | 所选 ID 的发布投影与来源 revision | 所有领域文件；索引-only caller 承担配套暂存责任 |
| `domain` | 所选正文及其受管资源树 | pending 索引的字节或缺失状态 |
| `all` | 上述两者 | 未选对象的 pending |

组合与写入规则：

1. HEAD、工作区索引严格验证；index／all 还验证 pending 索引，以其为组合基底。存在的三方索引须有相同集合 metadata、sourceRevision.metadata 与 definition；条目 revision 随选中投影一起替换。损坏或不兼容时零写入，转显式恢复或完整索引处理。HEAD 与 pending 都无索引时按工作区 metadata 建空基底；已有 HEAD 索引却将 pending 索引删除时，index／all 提示先恢复该删除。
2. index／all 从三方索引的 ID／name 并集解析选择。domain／all 为清理旧位置，还读取相对固定 HEAD 已变化的 pending 正式 Markdown 身份；unborn HEAD 将全部 pending 正式 Markdown 视为新增。该阶段使用现有路径变化查询与 pending 读取，覆盖仅 domain 暂存的新增、撤销和再次移动，不重建全部 HEAD 正文。归属无法确定或冲突时零写入诊断。
3. 选中对象在指定 scope 内采用工作区的完整表示，替换旧暂存及其中的部分暂存；未选对象沿用原 pending。相同结果按无变化处理，组合粒度是对象而非字段或正文片段。domain 还可由上述 pending 身份解析仅暂存存在的 ID。
4. 按三方受管位置处理选中对象的新增、删除与移动，清理被替换的旧正文路径；资源树取 HEAD、pending 和工作区中所选 owner 路径并集。所选现存来源须与工作区发布投影一致，缺失的新位置或身份漂移不能冒充已同步删除。
5. 身份更正同选旧、新 ID；index／all 的合成索引必须满足完整图和资源 owner 声明约束，相关依赖按合成结果核对。需要额外对象或共享资源进入待提交集合时提示补选，不自动暂存其他 owner。domain 仅保证自身范围，不证明 pending 索引与正文已配套。
6. 两次独立准备／复核保护所选来源、工作区索引与完整 pending；写入使用原 snapshot 和固定 HEAD 期望。任何漂移或读取失败均停止，保留原子替换、失败恢复、core.fileMode 语义与范围外 staged 删除。未选条目含义保持，索引 JSON 可规范化序列化。

例如：stage A 后 stage B 保留 A；修改 A 再 stage A 只刷新 A，B 的旧暂存保持。domain 保持索引原状；index scope 只消费发布投影，不读取工作区正文，完整 pending 内容保护仍执行。

两域在各自 stage owner 中复用[按 ID 投影组合](../../tools/index-runtime/src/staging-selection.ts)与 [pending snapshot／patch](../../tools/shared/src/version-control/pending-snapshot.ts)。Decision 改用选中更新集替代全目录来源重建；Investigation 将索引组合基底由 HEAD 改为 pending，并补齐 pending 旧位置。通用 index-runtime stage 默认契约不变，其他消费者不继承该产品放宽。

### Resulting Impacts

| 影响 | 处理要求 |
| --- | --- |
| 公开保证 | 两域 skill、领域／CLI 契约、维护说明和调用流程同步局部与全集责任 |
| 来源与恢复 | CLI／SDK 类型、renderer、help 及恢复手册落实 S2／S3 的明确分流 |
| 暂存组合 | 覆盖三种 scope、重复刷新、旧位置清理、依赖闭合及未选 pending 保护 |
| 共享与分发 | 保持其他消费者契约；从源码更新实际受影响的生成闭包与 skill 版本 |
| 行为证据 | 以小样本证明保持的结果和改变的保证，维护最小原生入口对应的 Case 与派生索引 |
| 长期理由 | 实施时按领域 owner 记录达到门槛的责任取舍 |

### 实施接点与验证

| 责任 | 已核对的实现入口与验证容器 |
| --- | --- |
| S1 | 两域 candidate／CLI candidate owner；Decision 的 candidate-scaffold、candidate-lifecycle，Investigation 的 candidate、candidate-read-context、cli-candidate-workflows 测试 |
| S2 | Decision 的生命周期／关系事务及 transaction-preflight；Investigation 的 publish-preparation、relation-transaction-preparation；两域首次建立、关系、事务恢复与历史确认测试 |
| S3 | 两域 query-search-content 及 Investigation query-search；共享 record-search、record-search-info；两域 search-info、search-modes／index-search、CLI 摘要与共享文本检索测试 |
| S5 | Decision 的 decision-stage-*，Investigation 的 staging-domain-*；两域 stage、representation、source-path、drift 与共享 pending snapshot 测试 |
| 声明与分发 | Decision 声明从运行时导出生成；Investigation 同步修改 `tools/investigation-report/api/check-investigations.d.mts`；索引持久 Schema 保持不变 |

上述为定位容器，实际新增／调整按可独立选择的最小原生测试节点维护 Case。保持漂移和范围保护的产品证明；实现读取次数变化时，重新审查相应 Proves，不能直接删掉安全断言。

交付依次执行受影响的两域 `test:*`、`sync:*`、`check:*`；共享文本、图或 Git 边界变化补跑对应测试。最后运行 `bun run check`。具体短命令由[工具链表](../../docs/tooling.md#工具维护命令)承接；包内容变化的两个 skill 各提升独立版本，若实际修改共享生成闭包则覆盖其全部消费者。

一万条成本验证：

- 以 `.change-plan.json.baseCommit` 固定改前实现，与改后实现使用独立、同字节的自有 Git fixture；每域 10,000 正式对象、9,000 条分组关系、2 份候选，Investigation 固定 5 个各 96 字节的资源。每次选择一个对象或一组小关系。
- 作为源码／生成入口性能验证，用 Node 直接执行两域公开分发 CLI，串行测量 S1 起草／候选读取、S3 小范围 content、S2 各普通维护命令和 S5 三种 scope；预算拒绝仅测实际触及原生上限的场景。S4 另对照默认工作流命令数及总成本。
- 每个可完成场景各测三次并逐次恢复自有基线；同运行时、默认 heap、相同缓存预热策略，采集实际 Node CLI 进程逐次 wall／user＋system CPU／maxrss 及中位数。fixture 准备和后验核对不计时，Bun wrapper 与准备进程内存不混入；失败保留实际效果与诊断。
- 独立核对预期索引差异、正文／资源、pending 和输出，只允许契约已列明的保证差异。选择小样本证明错误边界，一万条验证成本；十万条不进入默认门禁。
- 结论与必要原始数据进入新的调查轮次；历史测量资源只作形成时依据，不作为本轮可执行测试入口。

## Risks / Trade-offs

- S1／S2／S5 将部分无关来源问题的发现时点移到发布或集合级验收；S3 的文本新鲜度也不等于范围新鲜度。交付按各操作声明的保证解释结果。
- S5 刷新会替换所选对象原有的部分暂存；调用者需要保留该部分版本时应暂缓重选该对象。
- 全索引、图、完整 pending 保护和 Git 历史确认仍可能随存量增长；pending 旧位置发现还随已暂存变化增长。减少来源准备不等于消除事务内存峰值，收益与 OOM 改善以实测为准。
- 一万条短正文样本只代表声明的负载，不能外推所有附件规模和图形状。

## Open Questions

无阻塞实施的开放问题。实施中若出现需要新增状态／合并框架、扩大安全保证变更或额外用户授权的要求，先更新方案并讨论，再继续对应任务。
