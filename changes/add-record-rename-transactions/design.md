# Design

本设计让身份/name 迁移同时闭合由 name 或 ID 组成的记录文件路径，并为 legacy ID 在首次名称冲突前升级为标准 dated ID 提供闭合路径；本文仍为 Draft。

## Context

- [`显式纯 ID Plan`](../archive/separate-domain-ids-from-storage-details/)让 Markdown frontmatter 拥有 ID、索引保存独立 sourcePath；这表示路径不定义身份，但合法 basename 只有 name 或 ID，因此 name 改变时 rename 仍需要重新分配并移动文件。
- [`日期前缀身份 Draft`](../archive/adopt-date-prefixed-record-identities/)定义标准 `YYMMDD-<name>`、ID-first selector 和“name 路径可用则 name，否则 ID”的 locator。Legacy ID 在 name 唯一时可由 name lookup 使用，但与 dated ID 重名后无法作为标准 ID 精确选择。
- 为避免不可选状态，创建同名 dated 记录前需要先迁移 legacy ID。`new` 固定零写入返回 migration-required 和默认指引，用户显式 rename 后再重试；不能先创建冲突再补救。
- [`指定 ID 索引刷新 Plan`](../archive/add-selected-id-index-sync/)控制允许接纳哪些 ID 的来源变化。它不是 rename 的第二阶段；rename 必须在一个领域事务中共同提交来源、关系、资源和索引。
- Decision 的已建立记录有 `createdAt`，candidate 没有形成时间字段；Investigation 有 `formedAt`。这些事实决定 legacy 迁移能否证明历史日期。
- Decision candidate/active/archive、Investigation candidate/formal、关系和资源 owner 的 mutation lock、revision、tombstone 与恢复结果不同，不能抽象成只会移动文件的共享 runtime。
- Change Plan 不属于本 Change；其完成后删除不需要历史 rename。

## Goals / Non-Goals

目标：

- 为单个记录的 name 纠错、标准 ID 调整和 legacy 格式迁移提供可审阅、可预演且不覆盖的正式路径。
- 让日期身份创建流程能在写入同名 dated 记录前要求并完成 legacy ID 标准化。
- 在一次领域事务中同步全部由该领域拥有的 ID、关系、索引和资源事实。
- 按目标 name/ID 重新分配并移动记录 sourcePath，同时保持“路径不定义身份”的边界。
- 对已进入 Git HEAD 的身份迁移提供相称确认并保留普通 Git 历史。

非目标：

- 不为 Change Plan 增加 rename。
- 不因采用 dated ID 批量迁移全部 legacy 记录。
- 不自动解决合法重名、同日同名 ID 冲突或替用户选择历史日期。
- 不提供正则批量替换、通用路径重构平台或仓库外引用改写。
- 不接受任意目标路径或提供通用路径整理；rename 只在 name/ID 两种合法 basename 中分配目标路径。
- 不修改正文判断、formedAt、createdAt、status、alignment 或 relation type。
- 不把两个领域的事务源码合并为共享 rename runtime。
- 不把 rename 实现为“先改来源，再调用 selected sync 补索引”的两阶段操作。

## Decisions

### Intended Change

#### 输入与目标分类

每个领域提供一条普通入口；最终 CLI 名称按现有命令形状适配：

```text
rename <source-selector> <target-name-or-id> [--preflight]
```

Source 普通输入遵循 ID-first selector：后缀规范化后能解析为标准 ID 就 exact lookup，否则按 name key 查询。Name 多项命中仍报 ambiguous。

Target 复用相同的后缀规范化和标准 ID parser，但它定义新身份，不用 name 索引选择既有对象：

1. 解析为标准 ID 时，直接把它作为目标 ID，再验证其日期/name 与 source 的权威身份事实一致；目标不存在才可继续。
2. 解析失败时，完整文本是目标 name。标准 dated source 保留原日期并形成 `<old-date>-<target-name>`；legacy source 用权威形成日期形成 `<formed-date>-<target-name>`。
3. 不用不同 flag 要求用户预先声明 target 是 ID 还是 name，也不在标准 ID 目标冲突时回退为 name。
4. 根据最终 target name/ID 重新计算 sourcePath：完整生命周期目标中的 name 路径可用就选择 name，否则选择完整 ID；新旧路径不同时执行移动，目标被占用时遵守 no-overwrite，不能覆盖。

Legacy 冲突迁移必须在创建同名 dated 记录前、name 尚唯一时执行。`new` 返回的默认指引带出已识别 legacy ID 和建议目标 ID，但 rename 自身仍通过普通 ID-first selector 重读并确认 source；不存在创建与迁移的一体化隐式路径。

`--preflight` 完成与正式执行相同的集合、引用、revision、目标、路径和恢复准备，但不获取 mutation 提交点、不写文件、不保存 receipt。

#### 日期与 name 一致性

标准 ID 的 name 是日期前缀后的文本。Rename 改 name 就必须同步改变标准 ID；改变标准 ID 的 name 也必须在索引中产生同一 name，不能形成 ID 与 name 不一致的第二份事实。

Legacy ID 的 name 是完整 ID。升级日期来源优先为：Investigation 使用 `formedAt` UTC 日期，已建立 Decision 使用 `createdAt` UTC 日期。Decision candidate 没有权威形成时间时不能自动猜测，必须先解决开放问题中的日期来源。

#### Decision 事务

Decision 身份迁移至少拥有：

1. source candidate、active 或 archived Markdown 的 frontmatter ID；
2. 全部 candidate 与已建立 Decision 中指向旧 ID 的 relation targets；
3. 已建立集合的 index key、name key、state sourcePath 和 source revision；
4. 同一操作需要形成的 Git pending 选择说明，但不自动 stage；
5. old sourcePath 与按目标 name/ID 分配的 new sourcePath；两者不同时执行移动。

事务在锁内重读集合和索引，预演最终关系图、ID/name 唯一性与 sourcePath，再在目标路径变化时以 no-overwrite 移动来源，并原子改写文档 ID、关系和完整索引。Rename 不改变 status、alignment、createdAt、正文判断或 relation type。

#### Investigation 事务

Investigation 身份迁移至少拥有：

1. source candidate 或正式报告的 frontmatter ID；
2. 全部正式报告和 candidates 中指向旧 ID 的 relation targets；
3. 正式 index key、name key、state sourcePath 和 source revision；
4. `_resources/<old-id>/` owner 树到新 ID 的不覆盖移动；
5. 全部正式报告和 candidates 中引用旧 resource IDs 的受管引用；
6. old report sourcePath 与按目标 name/ID 分配的 new report sourcePath；两者不同时执行移动。

事务预演最终报告图、资源 owner 唯一性、资源引用闭合、新报告路径和完整索引。标准目标日期必须与 `formedAt` UTC 日期一致；成功后旧 ID、旧报告 sourcePath 和旧资源 owner 前缀不再出现在当前受管内容中。

#### 提交、恢复与版本控制

两个命令复用对应领域 mutation lock、revision 和恢复结果。目标身份已经进入 Git HEAD 时，正式执行要求领域专属的 recorded-history 确认；该确认只授权当前工作树迁移，不改写历史提交。

成功输出至少包含 source/target ID、source/target name、old/new sourcePath、关系/资源更新数量和 mutation outcome。按指定 ID 刷新索引可以复用无领域含义的 projection/diff 原语，但 rename 成功后不需要再运行公开 scoped sync。

### Resulting Impacts

- **Decision Records：** 新增 CLI/SDK rename surface、frontmatter ID rewrite、集合级 relation rewrite、name/ID-keyed index 重建和事务恢复测试。
- **Investigation Report：** rename 与 publish、set-relations、discard、resource owner 和 stage-index 共用集合锁及 revision，覆盖 candidate/formal、报告路径、关系、资源和索引组合恢复。
- **日期身份：** 创建同名 dated 记录前必须检查 legacy name；需要迁移时返回 migration-required 和默认 rename 指引，不能提交不可精确选择的状态。
- **路径：** ID/name rename 同时移动记录文件；目标 basename 只允许 name 或 ID，资源 owner 则继续随 Investigation ID 迁移。
- **Index Runtime：** 可以复用完整 projection/diff，但提交与恢复 envelope 仍由领域 mutation 拥有。
- **长期决策和分发：** 分别演进两个领域的身份迁移判断，更新工具、build 产物、skill 契约、版本、声明和测试证据。
- **实施依赖：** 显式纯 ID/sourcePath Plan 和日期身份的 parser、name index、locator 先完成；本 Draft 再实现 migration-required 指向的 rename 路径。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| Legacy 冲突迁移与日期创建互相依赖 | `new` 先零写入返回指引，用户在 name 唯一时显式 rename，再重试创建 |
| 全集合引用改写比单文档 ID 更新昂贵 | Rename 是低频维护事务，优先闭合正确性；锁内扫描并验证最终图 |
| Investigation 资源 owner 扩大事务范围 | 把 owner 目录和全部受管引用纳入同一预演与恢复 |
| 目标 name 路径已被其他记录占用 | 退回完整 target ID basename；若完整 ID 路径也冲突则 no-overwrite 失败 |
| 已记录身份迁移在 Git 中产生正文和关系变化 | 要求 recorded-history 确认并保留 Git 历史，不实现历史重写 |
| 相邻身份和索引 Change 同时修改 parser/index | 纯 ID 先实施；日期、rename、指定刷新在 readiness 中复核最终接口和集成顺序 |

## Open Questions

1. Decision candidate 没有 `createdAt` 时，legacy 标准化日期由新增 candidate 形成时间字段、显式用户输入还是其他权威事实提供？
2. Candidate rename 是否把引用 source 的其他未选择 candidates 一并纳入事务，还是要求先解除引用？
3. Recorded-history 确认参数和 preflight 结果 envelope 是否按两个领域共享最小字段，还是沿用各自现有术语？
