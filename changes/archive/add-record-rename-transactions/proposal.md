# Proposal

本 Plan 为 Decision Records 与 Investigation Report 分别增加可预演、可恢复的身份/name 迁移事务，并为 legacy ID 只在真实名称冲突前升级为标准 dated ID 提供正式路径。

## Why

显式纯 ID 与 sourcePath 分离后，文件路径不再定义身份；但合法 basename 只有 name 或 ID，两者都包含 name，因此真实 rename 通常仍会同时改变记录 ID、name 和 sourcePath。使用者需要在名称错误、身份格式迁移或 legacy name 即将重名时安全更新这些事实，以及由 ID 派生的关系、索引和资源 owner；手工改 frontmatter 或移动文件都无法闭合这些领域依赖。

Rename 不能替代合法重名建模，也不应为了采用日期格式立即批量改写历史。它应让 unique legacy name 继续使用，只有准备形成同名 dated 记录时才要求先完成可审计的 ID 迁移。

## Outcome

- Decision Records 和 Investigation Report 各自提供正式 rename 命令，由对应领域事务拥有 ID、name、索引、关系和资源更新。
- Rename 支持与正式执行具有相同逻辑门禁的只读 preflight；目标冲突、非法标准 ID、陈旧索引、悬空引用或无法证明恢复时不产生部分迁移。
- 普通 source 与 target 输入都遵循日期身份的 ID-first 管线；unique legacy name 可以在发生冲突前直接定位并迁移，不要求全量历史重命名。
- 标准 dated ID 的新 name 自动沿用原日期；legacy candidate 没有权威日期时，target 若只给 name 返回 `date-required`，必须显式提供完整标准 dated ID，绝不从 Git、mtime 或当前时间猜测。
- Rename 按目标 name/ID 重新计算记录 sourcePath：name 路径可用时使用 name，否则使用完整 ID；新旧路径不同时在同一事务中 no-overwrite 移动，文件 basename 不反向定义身份。
- 两个领域的关系始终改写为新完整 ID；Investigation 的资源 owner 路径和受管资源引用保持闭合。
- 命令输出共同最小字段：old/new ID、old/new name、old/new sourcePath、影响计数和 outcome；recorded-history 确认仍遵循各领域现有术语和命令风格。

## Scope

### Intended Change

为 Decision/Investigation 各自的 CLI、SDK、领域事务与契约增加单记录 rename。每个事务在领域 mutation lock 内重读并预演完整受管集合，再原子提交记录文件、结构化关系、完整派生索引及 Investigation 资源 owner/引用；文件路径按最终 target name/ID 重新分配。为日期身份的 `migration-required` 路径提供可执行的显式 legacy 标准化入口。

### Resulting Impacts

- 两个领域的 selector、dated-ID/name 解析、name/path 分配、CLI help、SDK 结果/诊断和 generated artifacts 必须承接 rename，不另建跨领域 rename runtime。
- Decision 的 candidate、active、archive、关系、pending/stage、完整索引、Git HEAD 确认、锁和事务恢复必须与新身份一致。
- Investigation 的 candidate/formal、关系、正式索引、资源 owner、资源引用、Git HEAD 确认、锁和事务恢复必须与新身份一致。
- 新建同名 dated record 的 legacy 冲突保持零写入：先返回 `migration-required`，用户显式 rename 成功后再重试 `new`；不做一体化创建加迁移事务。
- 可复用无领域语义的文件 no-overwrite 移动、完整投影/diff 或原子发布原语；领域事务、关系语义、资源语义、确认和结果不合并。
- 相关 skill 契约、版本、build 适配、CLI/SDK 声明、最小原生测试与 Test Evidence case 必须同步。

## Success Criteria

1. 两个领域都可通过标准 ID 或唯一 name 选择 source，并用标准 ID 或 name 指定 target；零项、歧义、非法 ID、name/ID 不一致、日期不一致和目标 ID/path 冲突均零写入且给出可行动诊断。
2. 标准 dated source 的 name target 保留原日期；legacy established Decision 由 `createdAt` UTC 日、legacy Investigation 由 `formedAt` UTC 日形成目标 ID；legacy Decision candidate 的 name target 返回 `date-required`，只有显式完整 dated target ID 才可继续。
3. 正式 rename 在领域锁内预演并提交完整受管关系图、记录 ID/name/sourcePath、完整索引和所需 pending/stage；candidate 与 established 记录中指向旧 ID 的所有受管结构化关系自动改为新 ID。
4. 记录文件仅使用 name 或完整 ID basename；name 路径可用时选 name，否则选 ID，路径变化以 no-overwrite 移动与内容、索引一起提交或恢复，不留下旧路径、重复来源或混合 ID。
5. Investigation rename 同时 no-overwrite 迁移 `_resources/<old-id>/` owner、更新所有受管 resource 引用，并在成功后证明旧 ID、旧报告路径和旧 owner 前缀不再被当前受管内容使用。
6. `--preflight` 零写入且报告共同最小计划字段与影响计数；执行路径沿用 Decision 的 recorded-decision 及 Investigation 的 recorded-report/candidate 确认术语，不改写 Git 历史。
7. 事务遭遇来源漂移、写入、索引发布、资源移动或清理失败时，沿用领域恢复 envelope，结果明确为 no-change、rolled-back、committed-cleanup-pending 或 partial-or-unknown；锁不可用时不写入。
8. 相关契约、声明、生成产物、Test Evidence 账本和最小原生测试一致，领域测试、生成边界检查和 `bun run check` 通过。

## Affected Owners

- `skills/decision-records/`、`tools/decision-records/`、`scripts/build/decision-records.ts`、Decision Markdown 与派生索引。
- `skills/investigation-report/`、`tools/investigation-report/`、`scripts/build/investigation-report.ts`、Investigation Markdown、资源与派生索引。
- `tools/shared/` 中已存在且确实无领域语义的文件、索引发布或恢复原语；不新增跨领域 rename runtime。
- `skills/test-evidence-review/`、`docs/test-evidence/` 及其统一派生索引。
- 已归档的 `separate-domain-ids-from-storage-details`、`adopt-date-prefixed-record-identities`、`add-selected-id-index-sync` 只作为实施依赖与行为基线，不重新打开或改写。
