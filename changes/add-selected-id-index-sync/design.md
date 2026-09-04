# Design

本设计把用户所说的“刷新指定 ID 索引”实现为 selected sync：用户可输入标准 ID 或唯一 name，领域层先按统一规则解析成 ID，再以 ID scope 限定本次允许接纳的来源变化。运行时仍证明完整当前投影，成功索引仍全局新鲜，任何未选择变化都会阻断写入。

## Context

- `tools/index-runtime/src/storage.ts` 的 `syncStateIndex` 当前先 `buildStateIndex`，再重读完整 source revision 检测构建期间漂移，最终比较或原子写入完整规范索引；它没有 selected ID 输入。
- `tools/index-runtime/src/staging.ts` 的 `stageSelectedIndexEntries` 已能按 ID 组合 Git revision index 与 workspace index，但它不读取领域来源，只修改 Git pending。同步与暂存的 baseline、目标和失败边界不同。
- Index Runtime v3 的 `entries` 和 `sourceRevision.entries` 都以领域 ID 为键，`sourceRevision.metadata` 单独表达集合级来源版本，具备计算 ID 级变化和识别全局变化的结构基础。
- Decision Records、Investigation Report 与 Test Evidence 都通过 shared runtime 维护可重建派生索引；Task Graph 索引是权威写模型，Change Plan 当前按目录实时发现，不属于本能力。
- Investigation 的 `sync-index` 已在领域 collection mutation lock 内执行；其他消费者需要保持各自当前并发保证。shared runtime 的 source-revision reread 继续提供构建漂移检测，但不声称能锁住工具外的手工文件修改。
- 本 Change 依赖 [`显式纯 ID 与 sourcePath 分离`](../archive/separate-domain-ids-from-storage-details/)和[`日期前缀身份`](../archive/adopt-date-prefixed-record-identities/)的 selector/name-index 契约完成。Decision/Investigation CLI 接受标准 ID 或 name，shared runtime 的最终 `selectedIds` 仍只接受解析后的精确 ID；文件路径和目录不是 selector。
- [`记录 rename Draft`](../add-record-rename-transactions/)规划的是来源、路径、关系、资源和索引共同提交的领域事务。它可以复用最终 shared runtime 原语，但不能把公开 selected sync 当成文件移动后的补写步骤；两者没有语义前置依赖。

## Goals / Non-Goals

目标：

- 让调用方精确声明本次同步允许接纳哪些领域对象的变化。
- 让 Decision/Investigation 的 selector 与其他普通命令一致：先尝试标准 ID，失败才按 name 索引解析。
- 保持完整来源验证、全局关系/集合约束、规范序列化和索引全局新鲜度。
- 对意外的其他来源变化 fail closed，并在任何写入前列出未选择 ID。
- 让 add/update/delete/rename 使用一套对称的 old/current ID union 语义，并把同一 ID 的内容、name 或 sourcePath 变化都归到该 ID。
- 在共享 runtime 固定 ID scope 和诊断，在各领域 owner 固定 selector-to-ID 解析。

非目标：

- 不以减少文件读取、解析或校验数量为目标，不增加 `readSelected(ids)` 来源接口。
- 不合并工作区同步和 Git pending staging，不让 selected sync 自动暂存任何文件。
- 不允许索引一部分 entry 新鲜、另一部分 entry 故意陈旧，也不改变现有 query/open 的全量新鲜度契约。
- 不让 selected sync 修复缺失、损坏、旧 definition 或集合 metadata 已变化的 baseline；这些情形使用全量 sync。
- 不为 Task Graph 或 Change Plan 增加不符合其状态模型的同步命令。
- 不用 selected sync 认可手工执行的 record rename，也不把现有或未来领域 mutation 改成“先提交来源、再同步索引”的两阶段操作。

## Decisions

### Intended Change

#### 术语与总体流程

| 术语 | 本 Plan 中的唯一含义 |
| --- | --- |
| baseline | selected sync 开始时严格解析的当前持久索引 |
| candidate | 从完整当前领域来源构建并验证的规范索引投影 |
| changed ID | baseline 与 candidate 中 entry 存在性、规范 state 或 per-ID source revision 不同的 ID |
| full sync | 不限制允许变化 ID，可创建或修复持久索引的现有同步模式 |
| selected sync | 只有 `changed IDs ⊆ selected IDs` 且集合级字段不变时才允许接纳的同步模式 |

```text
严格读取 baseline ─┐
                   ├─> 完整 diff ─> selected scope 门禁 ─> check 或原子写入完整 candidate
完整构建 candidate ┘                    │
                                        └─ 未选择变化或集合变化：零写入失败
```

该流程的“selected”只限制允许接纳的变化，不限制来源读取范围，也不改变最终索引的全局新鲜度。

#### 同步 scope

shared runtime 使用显式判别的同步 scope，而不是以空数组暗示全量：

```text
all
selectedIds: [id-a, id-b, ...]
```

公开 TypeScript 表面采用等价的 discriminated union。领域 CLI 以是否出现一个或多个 selector 映射 scope：不带 selector 是 `all`，至少一个 selector 是 selected。空字符串、控制字符和重复原始 selector 作为参数错误；解析后重复 ID 也失败。规范结果同时报告原始 selector、解析后的 `selectedIds` 与 `changedIds`，ID 列表按 locale 无关词法顺序排列。

Decision/Investigation selector 遵循日期身份契约：先移除一个大小写不敏感的末尾 `.md`，再尝试 calendar-valid `YYMMDD-name`；成功就得到精确 ID，失败就用完整剩余文本查询 name。由于 selected sync 本来就在同一次操作中严格读取 baseline 并构建完整 candidate，name 查询使用两侧 name 映射的 ID union：新增记录可以从 candidate 找到，删除记录可以从 baseline 找到。零项是 not-found，多项是 ambiguous，不按新旧索引、日期或状态猜测。

Test Evidence 没有单独的 name 身份规则，其 selector 仍规范化为精确 Case ID。领域层负责 selector 语义；shared runtime 只接收最终 ID，不理解日期、name 或 `.md`。

#### Selected baseline 与完整 candidate

selected sync 按以下顺序执行：

1. 校验 runtime definition、scope、context、index path 和原始 selector 的通用参数形状。
2. 严格读取并按当前 definition 解析持久索引作为 baseline。缺失、编码/Schema 无效或 definition/key definition 不匹配时失败并要求 full sync；selected 模式不能凭空决定未选择条目的可信基线。
3. 使用现有 `buildStateIndex` 构建完整 current candidate，执行领域全部来源、关系和集合校验。
4. 重读完整 source revision，并与 candidate revision 比较，保留现有构建期间漂移门禁。
5. 比较 baseline 与 candidate 的集合 metadata、`sourceRevision.metadata` 和其他不归属于单个 ID 的规范字段。任何变化都返回 collection-changed 并要求 full sync。
6. 领域 resolver 根据 baseline/candidate 的 ID/name 映射把 selector 收敛为 `selectedIds`；标准 ID 不存在及 name 零命中返回 not-found，name 多项命中返回 ambiguous。
7. 对 baseline/candidate 的 `entries` 与 `sourceRevision.entries` key union 排序，若某 ID 的 entry 存在性/规范状态或 per-ID revision 任一不同，则把它加入 `changedIds`。
8. 每个 selected ID 必须至少存在于 baseline 或 candidate 一侧；因此删除可选择旧 ID，新增可选择新 ID。不存在于两侧的 ID 是 selection error。
9. 若 `changedIds` 不是 `selectedIds` 的子集，返回全部 `unselectedChangedIds` 并零写入；selected 中未变化的额外 ID 不失败。
10. 门禁通过后，check mode 只报告 current 或 scoped stale 状态而不写入；write mode 使用现有原子发布与回读验证写入完整 candidate。

因为所有未选择 ID 的 entry 和 revision 已证明与 baseline 相同，所以成功写入完整 candidate 的实际逻辑差异只可能属于 selected scope；输出字节同时等于一次全量重建，避免制造混合新鲜度。

#### 操作语义

| 来源变化 | 必须选择 |
| --- | --- |
| 新增 | 新 ID |
| 修改内容、name、状态或 sourcePath，但 ID 不变 | 当前 ID |
| 删除 | 旧 ID |
| ID rename | 旧 ID 与新 ID |
| 只改变集合 metadata | 不能 selected sync，使用 full sync |

是否属于“修改”由完整 entry 和 per-ID source revision 比较共同决定。即使正文变化没有改变索引 state，只要 source revision 改变仍属于该 ID 的变化；反之，baseline entry 与其 revision 不一致的异常也不能被比较遗漏。

#### 结果与诊断

`StateIndexSyncResult` 增加明确的 scope 信息，并在适用时返回 selectors、排序后的 `selectedIds` 和 `changedIds`。稳定诊断至少区分：selection-invalid、selector-not-found、selector-ambiguous、selected-id-missing、unselected-changes、collection-changed 和 selected-baseline-invalid；每个 ID 级诊断携带 `stateId`，未选择变化完整列出而不是只报告第一项。

check mode 沿用“索引不是目标投影即失败”的门禁：若变化全部在 selected scope 中，返回可行动的 scoped stale 结果；write mode 才实际接纳。没有变化时 check/write 都成功且 `changed: false`。中断、来源漂移、写失败和回读失败继续使用现有同步恢复语义，不因 selected scope 自动重试。

#### 领域公开表面

三个消费者统一提供可重复选择入口；参数名按既有 CLI 风格最终固定，例如：

```text
sync-index [--select <name-or-id>...] [--write]
```

Decision 与 Investigation 接受各自标准 record ID 或 name，并按 ID-first 管线解析；Test Evidence 接受 Case ID。领域层在 baseline/candidate 上完成 selector 解析和 CLI 错误分类，再把 canonical IDs 交给 shared runtime 的变化门禁；runtime 不了解 `.md`、日期、name、Change root 或 Case 前缀等领域规则。

领域命令继续遵循自己的来源根、warning、lock 和输出 envelope。文档必须明确：`sync-index --select` 从来源更新 workspace index；`stage-index <id...>` 从 workspace index 组合 Git pending，二者不能互相替代。

### Resulting Impacts

- **Index Runtime：** 新增 sync scope/result 类型、baseline parser、entry/revision diff 和稳定诊断；full scope 继续走当前无需可信旧索引即可修复/重建的路径，不能因复用 selected 逻辑而收紧。
- **Decision Records：** `sync-index` 增加标准 ID/唯一 name selector，并继续验证完整 Decision 集合及关系；生命周期事务已有自己的完整索引提交语义，不被改成调用局部同步。
- **Investigation Report：** selected sync 增加同一 selector，并继续在 collection mutation lock 内验证完整正式报告、关系和资源；candidate 仍不是正式索引 entry，不能借 selector 绕过 publish。
- **Test Evidence：** `sync-index` 增加 Case ID 选择，topics/集合 metadata 变化必须 full sync；catalog 来源仍全量读取，Case 的 sourcePath 变化归属于该 Case ID。
- **Staging：** `stageSelectedIndexEntries` 的 pending baseline 与选择性组合保持不变；可以复用无领域含义的 selected-ID 验证小函数，但不能共享或混淆事务结果类型。
- **正式 rename：** rename 成功时仍在一个领域事务中发布完整最终索引；本 Plan 中“ID rename 选择旧、新 ID”的表格只定义 baseline/candidate diff，不授予绕过 rename 命令的手工迁移路径。
- **文档与分发：** 三个 skill、Index Runtime README、CLI help、SDK 声明、JSON Schema/生成产物和版本同步更新。
- **测试证据：** runtime 与三个领域的新增/修改最小原生测试入口分别维护 Test Evidence case，并在最终全量 catalog sync 前证明 scoped sync 自身不会隐藏其他 case 变化。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 仍然全量扫描，看起来不像性能型“增量同步” | 文档明确该能力是接纳范围精确；性能优化不是目标，完整扫描用于证明没有未选择变化 |
| 直接合并 selected entry 会留下陈旧索引 | 禁止 partial-freshness；只有全部其他 entry/revision 未变化时才写完整 candidate |
| baseline 损坏时 selected sync 无法修复 | fail closed 并要求 full sync；修复能力继续由现有全量入口承担 |
| 集合 metadata 无法归属某个 ID | selected scope 拒绝并要求 full sync，不把全局变化偷偷归给任意条目 |
| 工具外手工编辑可能与同步并发 | 保留 build/revision reread 和领域 lock；不宣称跨进程锁住任意编辑器，检测到漂移即零写入重试 |
| 用户把 sync 与 stage 混为一谈 | CLI 名称、帮助、结果 scope 与 skill 流程分别解释 workspace source 接纳和 Git pending 组合 |
| name 在 baseline/candidate 两侧映射不同 | 对两侧映射取 ID union；零项 not-found、多项 ambiguous，不猜测新旧优先级 |
| 纯 ID 与日期 selector 尚未完成 | Readiness 硬性依赖两个前置契约；不先实现另一套临时 selector |

## Open Questions

无。selected scope 的正确性、selector-to-ID 规则、baseline 要求、check/write 行为和领域范围已经确定；实现若需要改变 partial-freshness 或集合 metadata 规则，必须先修订本设计。
