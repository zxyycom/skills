# Proposal

本 proposal 规划统一 skill 管理的生命周期时间责任：工具负责当前时点，调用方只负责具有独立语义的显式时间；当前缺口由 investigation-report 候选创建入口修复。

## Why

`investigation-report new` 当前要求调用方先取得秒级 RFC 3339 时间戳，再通过 `--formed-at` 传回工具。记录当前调查时，这一步只是机械地转交工具自身能够确定的运行时事实，也使 CLI 和公开 API 与仓库内其他生命周期工具采用了不同责任边界。

相关时间字段审计表明，`decision-records new` 已自动取得候选 ID 的 UTC 日期，首次 `activate` 或 `evolve` 也会在事务内一次性生成 `createdAt`；Task Graph 的创建、更新和 lease 时间同样来自工具时钟。它们无需调用方先取得当前时间。真正缺失自动取时的是 investigation candidate 的 `formedAt` 创建入口，而查询边界、历史补录时间和证据实际时点具有调用方语义，不应被自动替代。

`formedAt` 的语义没有问题：它表示调查轮次的形成时点，写入后保持不变。需要调整的是缺省值的来源，并用 Decision Records 与 Task Graph 的现有行为验证同一规则在本次审计范围内成立。

## Outcome

本次审计覆盖的生命周期当前时间均由拥有对应 mutation 的工具一次性生成。调用方省略 `formedAt` 时，investigation candidate 创建入口读取一次当前时钟，生成 UTC、秒精度且无小数秒的 RFC 3339 时间戳；该值同时决定 candidate frontmatter 和 name-only Investigation ID 的 UTC 日期。

调用方提供 `formedAt` 时继续使用现有格式与日期约束。候选创建后，编辑、publish、同步和其他维护操作均保留该值。Decision ID 日期、首次建立的 `createdAt` 及后续不可变行为保持现状，并由针对性回归验证证明没有引入新的调用方取时要求。

## Scope

### Intended Change

- 将 CLI `new` 的 `--formed-at` 和公开 `createInvestigationCandidate` options 中的 `formedAt` 调整为可选输入。
- 在候选创建领域边界一次性解析 effective formedAt：显式值优先，缺省值来自工具时钟。
- 让 effective formedAt 继续进入现有的格式校验、ID 归一化、关系时间约束和 Markdown writer。
- 更新 CLI help 和 skill 说明，使当前调查使用缺省值，历史补录使用显式值。
- 以仓库内实际时间字段和调用入口为范围完成横向审计，并用 Decision Records 与 Task Graph 的现有自动取时、不变性和同事务一致性作为回归基线。

持久 candidate、正式报告和调查索引仍要求合法的 `formedAt` 字符串；默认仅作用于首次创建，不增加更新时间字段，也不改变 publish 等后续生命周期。Decision Records、Task Graph、时间范围查询、历史补录和证据时点的语义保持兼容。

### Resulting Impacts

- 源码 options、公开类型、候选创建逻辑和 CLI 参数准备需要共享同一缺省行为，避免形成两个时钟来源。
- Skill 固定契约、人类入口、独立版本、公开声明和生成 bundle 需要同步；索引 JSON Schema 应保持原有语义。
- 原生测试需要分别证明缺省路径、显式路径和非法显式输入，并按 test-evidence-review 契约同步 Case 与派生索引。
- Decision Records 与 Task Graph 不需要实现改动或版本递增，但其原生测试需要作为横向回归证据，证明自动取时与创建后不变性仍成立。

## Success Criteria

1. CLI 和公开 API 省略 `formedAt` 时均能创建 candidate，并写入合法的 UTC 秒级时间戳。
2. 同一次创建的 ID 日期和 frontmatter 来自同一个 effective formedAt，在 UTC 日期边界保持一致。
3. 显式时间继续原样控制形成时间和 ID 日期；空值、格式错误或完整 ID 日期不匹配继续失败。
4. Candidate 创建后的 `formedAt` 在全部后续维护动作中保持不变，既有数据和索引 Schema 无需转换。
5. Decision candidate 的日期继续由 `new` 自动取得，首次 `activate` 或 `evolve` 继续由工具一次取时；同一事务建立的多个后继共享 `createdAt`，archive、reactivate、mark-aligned 和 rename 均保留原值。
6. Task Graph 的创建、更新与 lease 时间继续由工具时钟生成；查询范围、历史覆盖和证据实际时点继续由调用方显式表达。
7. 稳定说明、源码、公开声明、生成产物、skill 版本、测试和测试证据一致，目标检查与仓库完整检查通过。

## Affected Owners

- `skills/investigation-report/SKILL.md`、固定契约和 `docs/skills/investigation-report.md`：行为、时间语义和使用入口。
- `tools/investigation-report/src/` 与 `tools/investigation-report/api/check-investigations.d.mts`：运行时 options、公开类型、缺省时间、身份归一化和 CLI。
- `skills/investigation-report/scripts/check-investigations.*` 与相邻索引 Schema：由现有生成入口维护的分发产物。
- `tools/investigation-report/tests/`、`docs/test-evidence/cases/` 和测试证据索引：原生测试及其证据投影。
- `skills/decision-records/`、`tools/decision-records/` 与 `skills/task-graph/`、`tools/task-graph/`：只读取和运行原生回归测试，确认其他受管生命周期时间已符合目标责任边界。
