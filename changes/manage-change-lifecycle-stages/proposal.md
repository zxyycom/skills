# Proposal

本 change 为 active Change 建立阶段元数据和基于 Git 项目演进距离的搁置流程；本文定义本次交付目标，实际行为以 change-plan skill 和固定契约为准。

## Why

建立本 change 时，`change-plan` 只区分 active 与 archived，并要求每个 active Change 从建立起就具备完整 proposal、design 和 tasks。它无法表达方向仍在起草、计划已经就绪、实施已经开始或计划已经搁置，也无法阻止搁置后的旧计划未经复核直接实施。

搁置不能只靠操作者凭感觉判断，日历时间也不能反映计划是否过时：如果整个项目没有继续演进，Change 放置再久也没有因此远离原计划。确认计划之后的项目提交数和累计 diff 行数能提供统一、可复核的信号，帮助快速识别已经退出当前实施主线的 plan。

## Outcome

- 每个 active Change 使用 `.change-plan.json` 表达 `draft`、`plan`、`implementation` 或 `shelved`。
- draft 只要求可识别的方向；plan 才要求完整三文件、完成 Readiness 并记录确认计划的 Git commit。
- plan 可以因明确暂停进入 shelved；命中固定 Git 距离规则后先成为候选，复核时可以用 `plan` 更新基线，或用 `reconcile` 转为 shelved；恢复后必须重新确认 plan。
- `list`、`show`、`check`、公共 API 和新增阶段命令能够报告、检查并推进同一阶段模型；archive 继续承接终态。
- 实施时为全部 active Change 一次性写入元数据，随后不再接受无元数据的 active 格式；历史 archive 保持原状。

## Scope

纳入范围：

- `.change-plan.json`、四个 active 阶段、阶段 artifact 门禁和合法转换。
- 只适用于 plan 形成后、implementation 开始前的显式或机械搁置。
- 基于确认计划 commit 的固定 `git-distance-v1` 规则。
- change-plan CLI、可导入 API、文本和 JSON 输出、检查与 archive 门禁。
- active Change 迁移、skill 与固定契约同步、生成制品、版本、测试和测试证据。
- 实施完成后同步长期决策并将其标记为 aligned。

不纳入范围：

- 使用时间、文件 mtime、每 Change 阈值或后台任务判断搁置。
- 为 task-graph、OpenSpec 或其他 skill 增加运行依赖。
- 改写历史 archive 或恢复 archived Change。

## Success Criteria

- active Change 缺少 `.change-plan.json` 或元数据不符合当前阶段结构时检查失败。
- draft 可以只包含最小 proposal；plan、implementation 和 shelved 使用完整三文件。
- 只有 Readiness 完成、artifacts 已提交并记录有效 `baseCommit` 的 plan 才能进入 implementation 或参与搁置判断。
- `git-distance-v1` 得到固定结果：`commitCount > 3 && changedLines > 1000`、`commitCount >= 9` 或 `changedLines >= 3000` 时成为 `shelve-candidate`，其余情况保持 current。
- 项目没有新提交或新提交只修改当前 change 目录时，plan 不会因经过现实时间而成为候选。
- `reconcile` 只转换候选；显式搁置保存原因；resume 回到待复核 plan，不能直接进入 implementation。
- 全部 active Change 完成迁移，行为 owner、分发制品、公共 API、测试证据和长期决策通过目标检查与仓库统一检查。

## Affected Owners

- [`skills/change-plan/SKILL.md`](../../skills/change-plan/SKILL.md) 与 [`change-plan-contract.md`](../../skills/change-plan/references/change-plan-contract.md)：阶段流程、元数据、artifact 和 CLI 契约。
- [`tools/change-plan/`](../../tools/change-plan/) 与 [`scripts/build/change-plan.ts`](../../scripts/build/change-plan.ts)：实现、公共 API、CLI、测试和分发制品。
- [`docs/tooling.md`](../../docs/tooling.md) 与 [`derive-change-plan-sdk-declarations-from-runtime-source.md`](../../docs/decisions/change-plan/derive-change-plan-sdk-declarations-from-runtime-source.md)：源码、生成声明和 metadata 机器契约的长期 owner 边界。
- [`tools/shared/version-control.md`](../../tools/shared/version-control.md)、[`tools/shared/src/version-control/`](../../tools/shared/src/version-control/)、[`tools/shared/tests/version-control.test.ts`](../../tools/shared/tests/version-control.test.ts) 与 [`docs/test-evidence/version-control/`](../../docs/test-evidence/version-control/)：领域无关 first-parent revision、numstat、仓库路径和错误语义及其验证证据。
- [`docs/skills/change-plan.md`](../../docs/skills/change-plan.md)、[`README.md`](../../README.md)、[`AGENTS.md`](../../AGENTS.md) 与 `skills/change-plan/agents/openai.yaml`：发现入口和能力说明。
- [`docs/test-evidence/change-plan/`](../../docs/test-evidence/change-plan/)：原生测试入口对应的证据 case。
- [`docs/decisions/change-plan/manage-change-lifecycle-stages.md`](../../docs/decisions/change-plan/manage-change-lifecycle-stages.md)：既有长期阶段方向，在完整事实成立后标记为 aligned。
- [`detect-shelved-plans-by-git-distance.md`](../../docs/decisions/change-plan/detect-shelved-plans-by-git-distance.md)：Git 距离机械搁置候选，在完整事实成立后以 aligned 激活。
- [`changes/`](../)：实施时仍存在的 active Change 元数据迁移。
