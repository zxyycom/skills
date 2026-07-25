# Design

本设计以 Markdown 的 `createdAt` 状态组合建立唯一的候选与已建立边界，让索引和 Git 都不再拥有隐含生命周期。

## Context

- 当前 `loadHeadDecisionPaths` 批量读取 Git `HEAD` 中的 Markdown 路径，查询用它显示 pending，严格检查用它阻止路径移除，并要求关系目标已提交。
- 当前 `activate` 拒绝激活已存在于 `HEAD` 的候选；`archive` 拒绝不在 `HEAD` 的已激活记录；`discard` 则允许删除任何不在 `HEAD` 的候选或已激活 pending 记录。
- 当前 Markdown 已经保存 `status`、`alignment` 和 `createdAt`，索引能够从有效 Markdown 确定性重建。
- 当前活动长期决策中，`allow-sequential-activation-of-prewritten-candidates.md`、`separate-activation-effect-from-head-pending.md`、`use-field-alignment-commands.md`、`use-configurable-self-contained-decision-root.md` 和 `decision-records/complete-current-decision-work-by-task-outcome.md` 明确依赖 HEAD/pending；实施前仍需重新扫描全部活动记录，避免遗漏其他冲突。
- 计划顺序要求先完成 `add-typed-index-metadata`，再实施本 change，最后实施 `organize-decisions-by-domain`。本 change 不依赖 metadata API，但它为后续路径迁移移除 HEAD 门禁。
- 当前未提交的 `docs/decisions/decision-records/use-controlled-decision-domains.md` 已有非空 `createdAt`，却只表达即将被替换的中间方案。它必须在本 change 切换建立状态之前，使用当前维护语义丢弃；最终领域决策由后续 change 创建。

## Goals / Non-Goals

目标：

- 使用一个可从 Markdown 本身恢复的字段组合区分未激活候选与已建立记录。
- 让激活、归档、丢弃和关系操作直接对应持久生命周期，不依赖提交时机。
- 让索引始终是当前已建立 Markdown 的完整派生视图。
- 保留严格候选清理、完整事务回滚和关系图约束。
- 允许显式、协调的结构迁移通过当前 Markdown 与关系重建索引。

非目标：

- 不从 Git 历史、内容相似度或旧索引推断重命名。
- 不建立删除保护数据库、路径别名、稳定 ID 或旧路径重定向。
- 不让 `createdAt` 以外的新字段承担“已提交”“待提交”或“迁移中”状态。
- 不改变决策何时生效、alignment 何时可标记或关系如何表达直接前序。

## Decisions

1. 合法候选固定为合法的新决策身份路径上的当前格式 Markdown，声明 `status: active`、`alignment: aligned|unaligned` 和 `createdAt: null`。候选不生效、不进入索引，且严格 `check` 在交付时仍要求全部候选已激活或丢弃。
2. 合法已建立记录固定为 `createdAt` 非空且满足生命周期组合的 Markdown。索引成员身份和查询新鲜度都从当前扫描到的完整已建立集合派生，不再把“已在旧索引”作为事实源；旧索引之外出现新的已建立文件时，查询必须报告索引陈旧，不能返回缺少该成员的结果。
3. 首次 `activate` 只把目标候选的 `createdAt` 写为当前秒级时间并同步完整索引；重新激活归档记录保留原时间。活动记录以相同 alignment 再次激活仍是无变化成功。
4. `sync-index --write` 每次从全部有效已建立 Markdown 生成完整索引。索引有效、缺失、损坏或陈旧都使用同一选源规则；普通未登记非空 `createdAt` 不再形成独立错误类别，而是使旧索引按正常新鲜度规则失效并在同步后成为索引成员。旧的 `registerPaths`、`includeUnindexedPaths`、`findIndexedRecord` 和按旧索引 entries 限定成员的分支全部删除。
5. `discard` 只接受未激活候选。任何已建立记录都使用 archive 或真实演进。
6. `archive` 接受任意活动已建立记录并清空 alignment，不检查 Git。关系目标必须是当前扫描到的已建立归档记录；候选、活动记录、缺失目标、重复、自环和环路继续失败。
7. 删除 `head-decision-paths.ts`、`HeadDecisionPathsResult`、validation context 中的 HEAD 字段、pending suffix、show 的 pending 字段、Git 专用错误和相关导出。决策工具不再依赖共享 version-control 运行时；测试支持层也不再初始化 Git 或提供 decision-records 专用 Git helper。共享组件本身不因本 change 改动。
8. 写事务仍先保存原 Markdown 与索引、应用目标变化、扫描并验证完整候选集合、同步索引、读回验证，普通失败恢复本次写入。移除 HEAD 参数不得削弱回滚边界。
9. 路径仍是当前集合内的决策身份，日常生命周期命令不自动移动路径。明确的结构迁移可以协调移动 Markdown、更新全部关系并重建索引；工具不推断旧身份，也不生成兼容映射。
10. 新的长期决策以“Markdown 生命周期决定建立状态”为完整方向，修订或替代上述活动 HEAD/pending 决策；仍有效的候选逐条提醒和 alignment 规则由新记录或保留的当前 owner 承接。

## Risks / Trade-offs

- 移除 HEAD 后，工具不再单独阻止一个无引用已建立文件被显式删除并随后重建索引；删除必须通过代码审查、当前 diff 和决策维护流程发现，而不是由提交历史承担隐藏生命周期。
- 索引从全部已建立 Markdown 重建会改变当前“有效索引限定成员”的恢复语义；测试必须覆盖缺失、损坏、陈旧索引和未激活候选共存。
- 多个活动长期决策包含 HEAD/pending，若只改代码和主契约会留下自相矛盾的决策基线；实施任务必须把决策演进与行为 owner 同步完成。
- 非 Git 根目录成为正常支持路径后，测试 fixture 不能再依赖仓库初始化来获得合法语义；需要增加真正无 Git 的端到端用例。
- 旧语义下丢弃中间领域决策不会自动恢复它已经归档的前序；第二与第三个 change 必须连续推进，并把最终领域决策的建立作为关闭这段有意中间状态的出口。

## Open Questions

无。

## Implementation Observations

- 独立审查发现，候选的单文件合法性在关系图校验前已经确定，`discard` 只检查该单文件状态。若候选关系指向活动记录、另一候选或现存但无效的目标，删除关系源后图错误会消失，事务因而可能成功。修复将关系图诊断结构化并归因到关系源记录，`discard` 现在同时要求目标候选的单文件与完整关系图均合法；无关系的其他合法候选不影响该门禁。
- 独立审查还发现，查询只使用完整已建立 Markdown 集合重算 `sourceRevision`，却没有强制该路径集合与索引 entry ID 集合相等。手工保留当前 revision 并删除或增加 schema-valid entry 时，`list`、`show` 和 `trace` 会把扫描器的成员差异降为 warning。修复在 decision-specific current-index owner 中增加集合一致性门禁；索引解析继续校验 state、ID 与 keys 的内部契约，revision 继续校验 established 源文本，成员集合不一致则在任何查询输出前失败。
- 两项修复均未引入 Git、domain/path 迁移或兼容 fallback。新增回归覆盖三类非法关系候选的丢弃拒绝与逐字节保留、其他合法候选共存时的成功丢弃，以及保持当前 revision 的缺 entry、额外 entry 对三种查询的拒绝。
