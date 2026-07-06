# 决策记录清单

本文件是 `docs/decisions/` 的导航 owner, 负责列出影响面、状态速查和具体决策链接。记录门槛、文件命名、状态关系、正文结构和更新流程由 [decision-record-rules.md](decision-record-rules.md) 承接。

## 阅读方式

1. 先按“影响面”确定要查的长期责任边界。
2. 在“决策清单”中查看对应记录; 文件名前缀中的状态表示当前有效性。
3. 非 `active` 决策的替代、修订或失效来源, 以决策文件 `## 状态` 中的后续决策链接为准。

## 状态速查

每个决策文件名包含状态段: `YYMMDD-<status>-short-title.md`, 例如 `260627-active-short-title.md`。状态只做目录浏览时的快速判断; 具体关系以决策文件的 `## 状态` 为准。

状态值:

1. `active`: 当前仍完整生效。
2. `amended`: 仍有回放价值, 但部分规则、命名或适用方式已被后续决策修订。
3. `superseded`: 已被后续决策替代, 不再作为当前规则执行。
4. `invalidated`: 因后续发现冲突、前提错误或无效结论而不再作为依据。

## 影响面

一级目录使用影响面 ID。影响面 ID 是稳定责任边界, 用 kebab-case 命名, 不使用日期、阶段或一次性动作。

当前影响面:

1. `decision-records`: 决策记录体系自身的结构、目的、命名、门槛和维护方式。
2. `git-commit-organizer-behavior`: `git-commit-organizer` skill 的提交粒度、类型选择和提交组织行为。
3. `project-tooling`: 本地脚本、打包方式、CI 和交付制品的长期契约。
4. `openspec-skills`: OpenSpec skills 的 change 语义、阶段门禁、CLI 协作和原始参考兜底策略。
5. `prompt-optimize-references`: `prompt-optimize` skill 引用文件的 owner 分工、结构拆分和跨文件关系。

可能出现的影响面示例:

1. `skill-behavior`: 多个 skill 共享的触发条件、执行流程、输出边界或完成检查。
2. `<skill-name>-references`: 单个 skill 的引用结构、规则归属和跨文件关系。

## 决策清单

`decision-records`:

1. [active: 2026-06-30 - 用 owner 命名决策记录根文档](decision-records/260630-active-name-decision-root-docs-by-owner.md)
2. [active: 2026-06-30 - 使用短日期命名并允许短决策结构](decision-records/260630-active-use-compact-decision-records.md)
3. [amended: 2026-06-30 - 给决策记录增加状态和关系](decision-records/260630-amended-track-decision-status-and-relations.md)
4. [amended: 2026-06-27 - 建立决策记录策略](decision-records/260627-amended-establish-decision-record-policy.md)

`git-commit-organizer-behavior`:

1. [active: 2026-07-02 - 调整 git-commit-organizer 的提交粒度、类型和创建命令](git-commit-organizer-behavior/260702-active-refine-commit-granularity-types-and-command.md)

`project-tooling`:

1. [active: 2026-07-03 - 用 skill package lock 承接发布和自更新](project-tooling/260703-active-use-per-skill-hash-lock-for-updater.md)
2. [active: 2026-07-03 - 自更新脚本跟随 latest release 制品](project-tooling/260703-active-follow-latest-release-for-skill-updater.md)
3. [active: 2026-07-02 - 迁移为 skills 单仓库布局](project-tooling/260702-active-use-monorepo-skills-directory.md)
4. [active: 2026-07-01 - 使用 tsgo 作为默认类型检查入口](project-tooling/260701-active-use-tsgo-for-typecheck.md)
5. [active: 2026-07-01 - 本地脚本的常见行为优先使用成熟库](project-tooling/260701-active-use-libraries-for-common-script-behavior.md)
6. [active: 2026-07-01 - 不用脚本校验 workflow 结构](project-tooling/260701-active-avoid-workflow-structure-validation.md)
7. [amended: 2026-07-01 - 用 Git hook 更新 package hash](project-tooling/260701-amended-update-package-hash-with-git-hooks.md)
8. [amended: 2026-07-01 - 使用版本化 release 发布 skill 制品](project-tooling/260701-amended-publish-versioned-skill-releases.md)
9. [amended: 2026-07-01 - 在 skill 包内分发自更新脚本](project-tooling/260701-amended-embed-self-update-script-in-skill-packages.md)
10. [amended: 2026-07-01 - 使用 skill hash 门禁 latest release 发布](project-tooling/260701-amended-gate-latest-release-by-skill-hash.md)
11. [superseded: 2026-07-01 - 给子仓库增加独立 release workflow](project-tooling/260701-superseded-add-submodule-release-workflows.md)
12. [amended: 2026-06-30 - 使用 latest release 自动发布 skill 制品](project-tooling/260630-amended-publish-skill-package-as-latest-release.md)

`openspec-skills`:

1. [active: 2026-07-06 - 将 OpenSpec change 作为临时计划并设置实现门禁](openspec-skills/260706-active-gate-temporary-change-plans.md)

`prompt-optimize-references`:

1. [active: 2026-07-01 - 压缩 prompt-optimize 入口并归档迁移副本](prompt-optimize-references/260701-active-compact-entry-and-archive-migration-copies.md)
2. [active: 2026-07-01 - 给 prompt-optimize 增加文档主承诺检查](prompt-optimize-references/260701-active-add-document-main-promise-check.md)
3. [active: 2026-07-06 - 将子代理任务说明移出 prompt-optimize](prompt-optimize-references/260706-active-move-subagent-guidance-to-dedicated-skill.md)
4. [amended: 2026-06-30 - 将 prompt-optimize 核心流程合并回入口](prompt-optimize-references/260630-amended-merge-prompt-optimize-core-flow-into-entry.md)
5. [superseded: 2026-06-30 - 将 prompt-optimize 改写规则重组为管线](prompt-optimize-references/260630-superseded-reorganize-prompt-optimize-rewrite-rules-as-pipeline.md)
