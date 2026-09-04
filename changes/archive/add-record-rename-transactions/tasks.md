# Tasks

任务先复核三个身份/索引前置 Change 已落地的接口及两个领域的事务边界，再分别实现可恢复 rename，最后以领域测试、Test Evidence 和全仓库检查证明没有留下混合身份或部分迁移。

## Readiness

- [x] 0.1 审核已归档的显式 ID/sourcePath、日期身份和 selected-index Plan 与当前两领域实现，确认标准 parser、ID-first source/target selector、name index、合法 basename、完整索引投影和公开 sync/stage 边界；记录 rename 不得重建临时兼容层或调用 scoped sync。
- [x] 0.2 为 Decision candidate/active/archive 与 Investigation candidate/formal 建立 rename 影响矩阵，覆盖权威日期来源、legacy Decision candidate `date-required`、ID/name/path 唯一性、全受管 relation、pending/stage、资源 owner/reference、Git HEAD 确认、锁、revision、tombstone 与恢复出口。
- [x] 0.3 审核各领域现有 CLI/SDK result、`--preflight`、recorded-history 确认和 mutation envelope，固定 rename 的共同最小计划字段与领域专属 flag/诊断命名；确认 preflight 零写入且正式执行锁内重读。

## Implementation

- [x] 1.1 在两个领域分别实现 source 与 target 的 ID-first rename 解析、日期/name 一致性和目标 ID/path 分配：标准 source 保留日期，legacy established Decision 使用 `createdAt` UTC 日、Investigation 使用 `formedAt` UTC 日，legacy Decision candidate 的 name target 返回 `date-required`，显式 dated target 走可审计验证。
- [x] 1.2 为 Decision Records 增加 rename CLI/SDK 与只读 preflight，在既有 collection lock 和 file/index transaction 内重读并提交 candidate、active/archive 的 ID/name/sourcePath、所有受管 candidate/established relation target、完整索引和 pending/stage ID 一致性；路径变化使用 no-overwrite move，不自动 stage。
- [x] 1.3 为 Investigation Report 增加 rename CLI/SDK 与只读 preflight，在既有 collection lock、资源和索引恢复边界内提交 candidate/formal ID/name/sourcePath、所有受管 relation、资源 owner 树、resource references 和完整正式索引；报告与 owner move 均 no-overwrite。
- [x] 1.4 接入各领域 Git HEAD recorded-history 门禁和结果输出：Decision 使用 recorded-decision 术语，Investigation 区分 recorded-report/candidate；成功与 preflight 都报告 old/new ID、name、sourcePath、影响计数和 outcome，并保持各自诊断/恢复 envelope。
- [x] 1.5 仅抽取已证明无领域语义的文件移动、投影/diff、原子发布或恢复辅助；更新两个 skill 契约、CLI help、SDK/Schema/生成产物、版本和 build 适配，不建立共享 rename runtime 或共享确认框架。

## Verification

- [x] 2.1 为两个领域的最小原生测试覆盖标准 ID 与唯一/歧义 name source/target、`.md` 兼容、非法/冲突 target、日期一致性、legacy established 自动日期、legacy Decision candidate `date-required` 与显式 dated target、name-path/ID-path 回退和 no-overwrite。
- [x] 2.2 验证 Decision rename 对 candidate、active、archive、全部 candidate/established relation、完整索引、pending/stage 和 Git HEAD 确认的闭合；验证 preflight 零写入、正式执行锁内重读、来源漂移和文件/索引写入失败时的 rollback、cleanup 或 partial-or-unknown 结果。
- [x] 2.3 验证 Investigation rename 对 candidate/formal、全部受管 relation、报告路径、资源 owner/reference、正式索引和 recorded-report/candidate 确认的闭合；覆盖 owner/report 移动、资源/索引失败、tombstone 恢复、cleanup-pending 与并发漂移。
- [x] 2.4 逐项维护受影响最小测试入口的 Test Evidence case 与统一派生索引；运行两个领域测试、生成边界检查及 `bun run check`，并审计成功迁移后当前受管内容不再引用旧 ID、旧 sourcePath 或旧 Investigation owner 前缀。
