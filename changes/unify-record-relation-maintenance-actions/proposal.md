# Proposal

本 Plan 为 Decision Records 与 Investigation Report 建立共同的正式记录关系替换动作。

## Why

两个领域都维护由来源记录指向直接前序的完整关系集合，但原地修正关系与改变记录生命周期目前没有共同选择条件。调用者难以判断何时使用单纯关系维护，何时使用 Decision 的复合演进事务。

## Outcome

两个 CLI 都以 `set-relations` 完整替换一个或多个正式记录的直接关系，并返回同形审核结果；Decision `evolve` 只承接同时建立后继或改变前序生命周期的复合事务。

## Scope

### Intended Change

- 统一 source 分组、完整替换、清空、摘要、预检和提交结果。
- 为 Decision Records 增加不改变生命周期的正式关系维护入口。
- 让 Decision `evolve` 复用共同关系模型，并使用同一 source 分组语法。

### Resulting Impacts

- 两个领域的 CLI、SDK、关系准备、审核输出和诊断需要对齐。
- Decision `evolve` 与 `set-relations` 需要共享规范化和审核模型，同时保持不同事务范围。
- Skill、人类入口、生成制品、版本、关系测试和 Test Evidence 需要同步。

## Success Criteria

1. 两个 CLI 支持相同的 `--source`、`--relation`、`--clear-relations`、`--relation-summary` 和 `--preflight` 语法。
2. 每个 source 分组表示完整直接关系集合；重复 source/target、空分组、摘要失配和 clear 混用得到一致错误分类。
3. 预检与正式成功都返回按 source ID 排序、包含 `phase`、`action`、`before` 和 `after` 的审核结果。
4. 多 source 提交保持单一事务；领域图验证和 relation type 继续由各领域拥有。
5. Decision `set-relations` 只修改关系与索引，`evolve` 才能同时改变生命周期；两个入口都使用 `--source` 分组。
6. 目标测试、生成检查、领域检查和完整仓库检查通过，Test Evidence 与测试入口一致。

## Affected Owners

- `tools/decision-records/` 与 `skills/decision-records/`
- `tools/investigation-report/` 与 `skills/investigation-report/`
- `docs/skills/decision-records.md`、`docs/skills/investigation-report.md`
- `docs/test-evidence/cases/` 与 `docs/test-evidence/test-evidence-index.json`
- 记录公共关系维护契约的 `docs/decisions/`
