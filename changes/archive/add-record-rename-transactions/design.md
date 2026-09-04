# Design

本设计让身份/name 迁移同时闭合由 name 或 ID 组成的记录文件路径，并为 legacy ID 在首次名称冲突前升级为标准 dated ID 提供单领域、可恢复的正式路径。

## Context

- [`显式纯 ID Plan`](../archive/separate-domain-ids-from-storage-details/)让 Markdown frontmatter 拥有 ID、索引保存独立 sourcePath；路径不定义身份，但合法 basename 只有 name 或 ID，因此 name 改变时 rename 仍需要重新分配并移动文件。
- [`日期前缀身份 Plan`](../archive/adopt-date-prefixed-record-identities/)定义标准 `YYMMDD-<name>`、ID-first selector、name index 和“name 路径可用则 name，否则 ID”的 locator。legacy ID 在 name 唯一时可由 name lookup 使用，但与 dated ID 重名后无法作为标准 ID 精确选择。
- 创建同名 dated record 前必须迁移 legacy ID：`new` 零写入返回 `migration-required` 和建议 target ID，用户显式 rename 后再重试；不存在隐式的“迁移旧记录并创建新记录”组合事务。
- [`指定 ID 索引刷新 Plan`](../archive/add-selected-id-index-sync/)只控制外部来源变化如何被索引接纳；rename 必须在一个领域事务中提交来源、关系、资源和索引，不能先 rename 再公开 scoped sync。
- 已建立 Decision 的 `createdAt` 与 Investigation 的 `formedAt` 是 legacy 目标日期的权威来源。新格式 Decision candidate 的 ID 已携带形成日；legacy Decision candidate 没有可推断日期的权威事实。
- Decision 的 candidate、active/archive、pending/stage、relation transaction、history baseline 与 recoverable file/index transaction 已有不同职责。Investigation 的 candidate/formal、publish/discard、resource owner、relation transaction、collection lock 和 tombstone/recovery 也已有不同职责；不能抽象成跨领域 rename runtime。
- Change Plan 不属于本 Change；其完成后删除不需要历史 rename。

## Goals / Non-Goals

目标：

- 为单个记录的 name 纠错、标准 ID 调整和 legacy 格式迁移提供可审阅、可预演且不覆盖的正式路径。
- 让日期身份创建流程能在写入同名 dated 记录前要求并完成 legacy ID 标准化。
- 在一次领域事务中同步全部由该领域拥有的 ID、关系、索引和资源事实，并按目标 name/ID 重分配 sourcePath。
- 对已进入 Git HEAD 的身份迁移提供相称的领域专属确认，保留普通 Git 历史。

非目标：

- 不为 Change Plan 增加 rename，不批量迁移全部 legacy 记录，也不自动解决合法重名、同日同名 ID 冲突或替用户选择历史日期。
- 不从 Git、文件 mtime、当前时间或正文猜测 legacy Decision candidate 日期；只提供 `date-required` 或接受用户显式完整 dated target ID。
- 不修改正文判断、formedAt、createdAt、status、alignment 或 relation type，不重写 Git 历史、仓库外引用或自由文本。
- 不接受任意目标路径或提供通用路径整理；记录 basename 只能是 name 或 ID，资源 owner 只随 Investigation ID 迁移。
- 不建立共享 rename runtime、共享确认框架或“rename 后再 sync-index”的两阶段实现；只复用无领域语义的原语。

## Decisions

### Intended Change

#### 输入、身份和路径分配

两个领域各有一条普通入口，参数形状按现有 CLI 适配为：

```text
rename <source-selector> <target-name-or-id> [--preflight] [领域专属 recorded-history 确认]
```

source 与 target 都先移除一个大小写不敏感的末尾 `.md`，然后尝试标准 dated ID parser；成功时是精确 ID，失败时是 name。source 的 name lookup 在当前完整受管集合中执行：零项 not-found，多项 ambiguous，不按日期、状态或目录顺序猜测。target 不查 name 索引选择对象：解析为标准 ID 就直接定义 target ID；解析失败则是 target name。标准 ID 解析成功后不回退为 name。

target 必须不存在，且最终 ID 与 name 语义一致。标准 dated source 以原日期加 target name 形成 ID；target 显式 dated ID 的日期与该来源的权威日期一致。legacy established Decision 由 `createdAt` UTC 日、legacy Investigation 由 `formedAt` UTC 日形成 ID。新格式 Decision candidate 的已有 dated ID 自身提供日期。legacy Decision candidate 若 target 是 name，返回 `date-required` 并零写入；用户必须提供完整标准 dated target ID，显式 target 的日期即为该次标准化选择，仍需验证 target name 与 ID suffix 一致。

最终 target name/ID 先通过完整集合的 ID、name 和 sourcePath 唯一性预演，再重算 sourcePath：对应生命周期目标中的 `<name>.md` 未占用时用它，否则尝试 `<id>.md`；两者都不可用时 no-overwrite 失败。新旧 sourcePath 不同就移动，移动与内容/索引提交属于同一领域事务；不因路径恰好不变而跳过身份、关系或索引更新。

#### 共同 preflight 与领域专属执行确认

`--preflight` 重用正式 rename 的 source/target 解析、全量集合扫描、关系图、索引新鲜度、路径/资源冲突、revision 和恢复可行性检查，但不进入 mutation 提交点、不持久化 receipt、不写文件、索引、pending 或资源。其稳定输出至少含：old/new ID、old/new name、old/new sourcePath、影响计数和 `outcome`；字段之外的诊断、领域影响明细和恢复建议保留各自 result envelope。

正式执行重读同一事实并在领域 mutation lock 内完成提交，防止 preflight 结果被当作写入授权。记录已进入 Git HEAD 时，Decision 添加符合既有 `--delete-recorded-decision` 词汇的 recorded-decision rename 确认；Investigation 按现有 formal report 与 candidate 的破坏性确认术语分别提供 recorded-report 或 recorded-candidate rename 确认。确认只授权当前工作树的 rename，绝不改写历史；没有确认时返回零写入的行动诊断。两个领域不为表面一致另建共享 flag 或确认类型。

#### Decision 事务

Decision rename 在既有 collection mutation lock 内重读 candidate、active、archive、派生索引和 history baseline，并预演：

1. source candidate、active 或 archived Markdown 的 frontmatter ID/name；
2. 所有 candidate 与已建立 Decision 中指向旧 ID 的结构化 relation target；
3. 已建立集合的 index key、name key、state sourcePath、source revision，以及受影响 ID 的 pending/stage 选择说明；
4. old/new sourcePath 的 no-overwrite move 和 Git HEAD recorded-decision 确认。

成功时改写 source ID/name、自动改写上述所有受管关系、移动记录（若需要）并发布完整索引；pending/stage 不自动 stage，但其 ID 选择、输出与后续操作不得留下旧 ID。事务不改变 status、alignment、createdAt、正文判断或 relation type。使用既有 Decision file/index transaction 的 preflight、回读、rollback 与 cleanup outcome，不把 candidate 或 active/archive 的生命周期规则抽到 shared runtime。

#### Investigation 事务

Investigation rename 在既有 collection mutation lock 内重读 candidate/formal 报告、正式索引、资源 owner、受管 resource 引用和 Git history 条件，并预演：

1. source candidate 或正式报告的 frontmatter ID/name 和 old/new report sourcePath；
2. 所有 candidate 与正式报告中指向旧 ID 的结构化 relation target；
3. 正式 index key、name key、state sourcePath、source revision；
4. `_resources/<old-id>/` 到 `<new-id>/` 的 no-overwrite owner move，以及所有受管 resource ID/reference rewrite；
5. target 标准日期与 `formedAt` UTC 日一致，及 recorded-report/candidate 确认。

成功时在同一恢复边界内改写报告 ID/name、全部受管关系与资源引用、移动报告和 owner 树（若需要），并发布完整正式索引。candidate 不是正式 index entry，但其关系和资源仍必须同图验证；事务不改变 formedAt、正文、tags、status 或 relation type。重用 Investigation 已有的 tombstone、恢复、回读和 cleanup outcome，但不把资源语义暴露给 Decision 或 shared runtime。

#### 恢复、复用和测试边界

两个实现可以复用已经无领域语义的安全文件 no-overwrite move、完整投影/diff、原子索引发布或低层恢复辅助；调用者必须由各领域事务拥有。每一写入点都先存储可验证的原内容和移动计划；失败后按现有领域 envelope 回滚，无法证明恢复时报告 `partial-or-unknown`，提交完成但清理失败时报告 `committed-cleanup-pending`。锁、来源 revision 或回读失败一律不把 rename 伪装成成功。

测试以各领域最小原生入口证明 selector/日期、candidate/established 覆盖、关系自动纳入、path/resource move、recorded confirmation、preflight 零写入、并发漂移、写入/索引/资源失败和恢复；同步更新每个受影响入口的 Test Evidence case 与派生索引。

### Resulting Impacts

- **Decision Records：** 新增 CLI/SDK rename surface、source/target selector 与日期诊断、ID/name rewrite、全集合 relation rewrite、path move、pending/stage ID 一致性、name/ID-keyed index 重建与事务恢复测试。
- **Investigation Report：** rename 与 publish、set-relations、discard、resource owner 和 stage-index 共用集合锁及 revision；覆盖 candidate/formal、报告路径、关系、资源、正式索引与组合恢复。
- **日期身份：** 同名 dated `new` 保持 `migration-required` 的零写入指引；legacy candidate 的 date-required 不猜测时间，显式 dated target 才授权其日期选择。
- **索引 Runtime：** 可以复用完整 projection/diff 或原子发布，但 rename 不调用公开 selected sync，且提交/恢复 envelope 继续由领域 mutation 拥有。
- **文档与分发：** 两个 skill 的规则、CLI help、SDK 声明、Schema/生成产物、版本和 Test Evidence 随行为同步；不修改已经归档 Change 的历史 artifacts。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| legacy 冲突迁移与日期创建互相依赖 | `new` 先零写入返回指引，用户在 name 唯一时显式 rename，再重试创建 |
| 全集合引用改写比单文档 ID 更新昂贵 | Rename 是低频维护事务；锁内扫描并验证最终图优先于性能 |
| legacy Decision candidate 缺少权威日期 | name target fail closed 为 `date-required`；只接受用户显式完整 dated ID，不猜测 |
| name/ID 两种 basename 和 lifecycle 目录交叉 | 先预演生命周期路径与双重唯一性；name 不可用才回退 ID，任何目标冲突均 no-overwrite |
| Investigation 资源 owner 扩大事务范围 | owner 树和全部受管资源引用进入同一预演、tombstone 和恢复边界 |
| 已记录身份迁移会扩大 Git diff | 要求领域专属 recorded-history 确认并保留 Git 历史，不实现历史重写 |
| 相邻身份和索引 Change 已改变 parser/index | readiness 审核归档 Change 的实际接口和当前实现；不重建临时 selector 或二阶段 sync |

## Open Questions

无。日期来源、candidate 引用覆盖、preflight 最小字段和领域专属 recorded-history 确认均已确定；实现如需改变这些边界，必须先修订本 Plan。
