# Proposal

本 Plan 计划让 Decision Records 与 Investigation Report 在形成新记录或重新开展调查前，先恢复可复用的已有认识，再决定是否需要新工作。

## Why

两个领域已经提供 `candidates`、`list`、`search`、`show` 与 `trace`，但查询在行为入口中的前置程度不一致。Decision Records 已要求恢复相关判断，Investigation Report 则仍可能让调用者先创建候选或重新调查，再发现已有报告已经回答同一问题。这样会产生重复调查，也会跳过“复用形成时认识还是按当前事实复查”的用户选择。

命令级 help 已列出主要参数，但普通查询所需的筛选组合、匹配范围、候选边界、截断结果和后续读取方式仍主要散落在固定契约中。Help 应成为自足的运行时入口，固定契约继续拥有精确语义，从而避免建立并行说明 owner。

## Outcome

两个 skill 都先按已知信息执行最小的记录发现与完整读取，再决定继续候选、完善原记录、形成新记录或停止维护。当已有调查大致回答用户提出的“调查一下”且用户没有明确要求重新验证时，agent 先概述原报告的形成时间、关键结果、依据与边界，再询问是复用已有认识还是按当前事实复查。`list` 与 `search` 的命令级 help 提供这一路径所需的关键语义、结果边界和简短示例，固定契约继续承接完整规则。

## Scope

### Intended Change

- 两个 skill 按当前已知 selector、主题和任务意图选择最小查询入口，不固定 candidate-first 或正式记录优先的机械顺序。
- 在准备建立新记录前同时排除重复 candidate 与已有正式记录；命中已有调查且当前性意图不明确时，提供“复用既有结论”或“按当前事实复查”的简短选择。
- `list` 与 `search` help 只投影完成普通发现与后续完整读取所需的语义，不复制固定契约。

### Resulting Impacts

- 两个 `SKILL.md` 与人类入口需要把记录恢复移到新建或重新调查之前，并明确查询停止条件。
- Investigation Report 需要把复用/复查分流表达为体验优化，而不是正确性门禁；明确当前、最新或重新调查时直接复查。
- 两个 CLI 的 query help、行为测试、生成制品、版本与 Test Evidence 需要在最终命令表面上同步。

## Success Criteria

1. 准确 candidate、准确正式 ID、metadata 条件和正文主题分别走信息损失最小的查询入口，不要求无差别扫描全部 candidate。
2. 新建记录前能够发现相关 candidate 与正式记录，并据此选择继续候选、完善原记录、建立独立记录或停止维护。
3. 已有调查大致回答普通“调查一下”且用户没有表达当前性时，先简述形成时间、结论和边界，再询问复用既有结论还是按当前事实复查。
4. 明确要求当前、最新、重新调查或项目规则要求当次验证时直接复查；明确要求查找、总结或审阅已有材料时直接复用，不额外询问。
5. `list` 与 `search` help 能说明正式记录/candidate 边界、搜索来源、筛选组合、结果上限、warning 与 `show` 后续入口，固定契约仍是精确语义 owner。
6. 两个 skill、help、生成制品、版本、目标测试和 Test Evidence 保持一致，并通过领域检查与完整仓库检查。

## Affected Owners

- `skills/decision-records/` 与 `tools/decision-records/`
- `skills/investigation-report/` 与 `tools/investigation-report/`
- `docs/skills/decision-records.md`、`docs/skills/investigation-report.md`
- `docs/test-evidence/cases/` 与 `docs/test-evidence/test-evidence-index.json`
- 记录公共上下文恢复方向的 `docs/decisions/`
