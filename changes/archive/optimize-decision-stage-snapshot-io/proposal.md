# Proposal

本 Change 计划在不削弱完整决策快照与 pending 并发安全的前提下，把 `decision-records stage` 的 Git 进程成本从随完整集合增长收敛为固定批次成本加实际变化成本。

## Why

`decision-records stage <decision-id...>` 必须以 revision 中的完整决策集合为基线，只叠加显式选择的 filesystem 决策，再从同一批 Markdown 重建统一索引并原子替换 pending 决策范围。这些完整集合语义负责索引同源、关系完整和未选择变化隔离，不能为了加速而移除。

当前实现却把完整集合处理展开成按文件重复的 Git 调用：每个 revision 决策文件分别解析 revision、查询 tree 和读取 blob，每个目标文件又分别创建 blob。即使目标内容没有变化，Git 进程数仍随完整集合线性增长；进程启动和小文件访问成本较高的平台会进一步放大该问题。隔离复现已经确认主要成本来自这条 N+1 调用链，而不是必须保留的完整 Markdown 校验。

现有测试证明小集合下的选择、完整索引、冲突和恢复语义，但没有约束 Git 调用数量或集合规模增长，因此无法阻止同类 N+1 回归。

## Outcome

`decision-records stage` 继续构造并完整验证统一 pending 快照，但 revision 内容通过批量版本管理操作读取，锁内已验证且未变化的 pending entry 被复用，无变化目标不重新发布相同 Git index。领域解析仍随完整决策集合线性执行，Git 子进程数量则只随固定批次和实际需要创建的新 blob 数增长，并由规模化调用计数测试持续约束。

## Scope

### Intended Change

- 在共享版本管理接口中增加 `readRevisionFiles(revision, options)`，按 revision 和字面路径范围批量读取文件内容；Git 实现只解析一次 revision、枚举一次 tree，并通过一个 batch blob 读取获得完整结果。
- 让 Decision Records stage 使用批量 revision 快照替代 `listRevisionFiles + N × readRevisionFile`，同时保持完整来源组合、Markdown/关系校验、索引重建和所选 filesystem 来源复核。
- 在共享 pending 替换事务中复用锁内已经验证为目标普通文件表示且字节相同的现有 entry，只为新增或变化内容创建 blob。
- 在锁内目标 entries 与当前 entries 完全一致时返回成功且不重新发布 Git index；实际变化继续执行更新、写后核对、原子发布和恢复。
- 增加代表性 150/300 文件集合的 Git 调用计数与行为回归证据，并记录同一环境中的前后墙钟结果作为辅助观察。

### Resulting Impacts

- `VersionControlRepository`、Git tree/blob 读取实现和版本管理说明需要承接批量 revision 内容契约、排序、路径范围和失败语义。
- `replacePendingFiles` 的内部目标构造和无变化发布路径会改变，但 expected revision/files、普通文件限制、范围隔离、实际写入读回和恢复的公共语义保持不变。
- Decision Records stage 的 revision 基线读取会改变；CLI、Decision ID 选择、完整目标集合、既有 pending 拒绝和输出协议保持不变。
- 修改共享源码可能改变 Change Plan、Decision Records、Investigation Report、Task Graph 和 Test Evidence 的内联分发制品；实施时必须按真实构建差异同步全部受影响产物，只提升发生版本承载变化的 skill 版本。
- 新增或修改的最小原生测试入口需要更新对应 Test Evidence case 和统一派生索引。

## Success Criteria

- 选择一个 Decision ID 时，pending 目标仍包含完整 revision 决策集合、所选 filesystem 状态和从同一来源重建的索引；未选择 filesystem 变化及决策范围外 pending 内容保持隔离。
- Batch revision reader 对全 revision、无匹配结果、单/多字面 scope、可执行文件、符号链接、Gitlink/异常 tree 记录、SHA-1/SHA-256 object ID 和 Git 失败保持明确且经过测试的结果。
- `replacePendingFiles` 只复用 stage-0、普通非可执行、同路径同字节的内部 entry；expected revision/files 在锁内仍被核对，实际写入仍完成成员与字节读回，冲突和恢复失败仍使用现有公共错误。
- 测试在 fixture 建立完成后单独计数 stage 期间的 Git 调用。150 与 300 文件的无变化 stage 均不超过 20 次 Git 调用；各只修改一个已建立决策的 stage 均不超过 25 次，且增加集合规模不会使调用数按文件数增长。
- 实施记录同一环境下优化前后的 stage 调用数和墙钟结果；墙钟只作为平台相关观察，不代替调用复杂度门禁，也不声称已经完成真实 Windows runner 验证。
- 共享版本管理、Decision Records、Index Runtime 及其他受影响 staging consumer 的行为测试通过；全部生成制品、skill 版本、测试证据、类型、lint、格式和全仓检查一致。

## Affected Owners

- [`tools/shared/version-control.md`](../../tools/shared/version-control.md)、`tools/shared/src/version-control/` 和 `tools/shared/tests/version-control.test.ts`：批量 revision 读取、pending 替换、Git 实现及恢复证据。
- `tools/decision-records/src/decision-stage-service.ts` 与 `tools/decision-records/tests/stage.test.ts`：完整决策目标构造、批量基线消费和规模回归。
- [`skills/decision-records/SKILL.md`](../../skills/decision-records/SKILL.md) 与相邻 references：本 Change 保持其领域规则不变；若实现需要改变可观察行为或恢复边界，必须先修订计划而不是直接修改。
- `tools/index-runtime/`、`tools/investigation-report/`、`tools/task-graph/`、`tools/test-evidence/` 和 `tools/change-plan/`：共享 pending 实现的现有消费者，需要按实际影响回归并同步内联产物。
- [`docs/tooling.md`](../../docs/tooling.md) 与 [`docs/coding-style.md`](../../docs/coding-style.md)：共享源码、生成边界、实现组织和验证要求的现有 owner；没有规则变化时只引用，不重复改写。
- `docs/test-evidence/`：受影响最小原生测试入口的 case 与派生索引。
