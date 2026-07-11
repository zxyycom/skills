# 决策记录清单

本文件只承接本仓库决策的阅读方式、状态速查、影响面和当前活动决策。固定契约见随包 [decision-record-rules.md](../../skills/decision-records/references/decision-record-rules.md)，本仓库的更高记录门槛见根目录 `AGENTS.md`。

## 阅读方式

1. 先按“影响面”确定要查的长期责任边界。
2. 在“活动决策”中查看已经确认并成为后续工作依据的已生效记录。
3. 需要历史时, 运行 `node skills/decision-records/scripts/decision-records.mjs list --all` 或按状态筛选。
4. 非 `active` 决策的替代、修订或失效来源, 以决策文件 `## 状态` 中的后续决策链接为准。

## 状态速查

每个决策文件名包含状态段: `YYMMDD-<status>-short-title.md`, 例如 `260627-active-short-title.md`。默认索引只列出 `active`; 其他状态继续保留并通过 CLI、文件树和状态关系访问。具体关系以决策文件的 `## 状态` 为准。

状态值:

1. `active`: 已经确认并成为后续工作依据的已生效决策, 不是进行中的任务状态。
2. `amended`: 仍有回放价值, 但部分规则、命名或适用方式已被后续决策修订。
3. `superseded`: 已被后续决策替代, 不再作为当前规则执行。
4. `invalidated`: 因后续发现冲突、前提错误或无效结论而不再作为依据。

## 影响面

一级目录使用影响面 ID。影响面 ID 是稳定责任边界, 用 kebab-case 命名, 不使用日期、阶段或一次性动作。

当前影响面:

1. `decision-records`: 决策记录体系自身的目的、固定契约、owner 和演进方式。
2. `decision-records-skill`: `decision-records` skill 的触发、确认、读取、写入、数据 owner 和 CLI 边界。
3. `git-commit-organizer-behavior`: `git-commit-organizer` skill 的提交粒度、类型选择和提交组织行为。
4. `project-tooling`: 本地脚本、打包方式、CI 和交付制品的长期契约。
5. `openspec-skills`: OpenSpec skills 的 change 语义、阶段门禁、CLI 协作和原始参考兜底策略。
6. `prompt-optimize-references`: `prompt-optimize` skill 引用文件的 owner 分工、结构拆分和跨文件关系。

## 活动决策

`decision-records`：

1. [active: 2026-07-11 - 用直接关系和归并决策限制历史读取](decision-records/260711-active-bound-history-with-direct-relations.md)
2. [active: 2026-07-11 - 使用随包 reference 作为唯一固定契约](decision-records/260711-active-use-bundled-contract-owner.md)
3. [active: 2026-06-30 - 使用短日期命名并允许短决策结构](decision-records/260630-active-use-compact-decision-records.md)

`decision-records-skill`：

1. [active: 2026-07-11 - 使用显式确认控制决策写入](decision-records-skill/260711-active-require-confirmed-decision-writes.md)
2. [active: 2026-07-10 - 使用 CLI 维护活动索引并归档失效决策](decision-records-skill/260710-active-use-cli-active-index-and-invalidated-archive.md)

`git-commit-organizer-behavior`：

1. [active: 2026-07-02 - 调整 git-commit-organizer 的提交粒度、类型和创建命令](git-commit-organizer-behavior/260702-active-refine-commit-granularity-types-and-command.md)

`openspec-skills`：

1. [active: 2026-07-06 - 将 OpenSpec change 作为临时计划并设置实现门禁](openspec-skills/260706-active-gate-temporary-change-plans.md)

`project-tooling`：

1. [active: 2026-07-11 - 分离 skill 分发脚本源码与生成产物](project-tooling/260711-active-separate-skill-script-source-and-generated-artifacts.md)
2. [active: 2026-07-03 - 自更新脚本跟随 latest release 制品](project-tooling/260703-active-follow-latest-release-for-skill-updater.md)
3. [active: 2026-07-03 - 用 skill package lock 承接发布和自更新](project-tooling/260703-active-use-per-skill-hash-lock-for-updater.md)
4. [active: 2026-07-02 - 迁移为 skills 单仓库布局](project-tooling/260702-active-use-monorepo-skills-directory.md)
5. [active: 2026-07-01 - 不用脚本校验 workflow 结构](project-tooling/260701-active-avoid-workflow-structure-validation.md)
6. [active: 2026-07-01 - 本地脚本的常见行为优先使用成熟库](project-tooling/260701-active-use-libraries-for-common-script-behavior.md)
7. [active: 2026-07-01 - 使用 tsgo 作为默认类型检查入口](project-tooling/260701-active-use-tsgo-for-typecheck.md)

`prompt-optimize-references`：

1. [active: 2026-07-06 - 将子代理任务说明移出 prompt-optimize](prompt-optimize-references/260706-active-move-subagent-guidance-to-dedicated-skill.md)
2. [active: 2026-07-01 - 给 prompt-optimize 增加文档主承诺检查](prompt-optimize-references/260701-active-add-document-main-promise-check.md)
3. [active: 2026-07-01 - 压缩 prompt-optimize 入口并归档迁移副本](prompt-optimize-references/260701-active-compact-entry-and-archive-migration-copies.md)
