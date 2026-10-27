### Case GATE-SELECTED-GENERATION-SKILLS-001: 生成前置范围来自实际选中 consumer

Tests:
- `test:624f6d184594da90260d7aa4912f7465859fc9b0b03abfa9f93fa22b5f5914e1`

Tags:
- `repository-tooling`

Contract:
- 生成 provider 只联合选中 consumer 的必要 skill；generated-artifacts 明确选择全量，其余无生成 consumer 的能力不带入域。

Proves:
- gate-tests 为空，mcpshell、test-evidence、skill-validator 与 skill-updater 分别只映射到其实际消费 skill；共同 reader 映射 DR 与 IR，重复与联合去重排序；generated-artifacts 返回全量。
