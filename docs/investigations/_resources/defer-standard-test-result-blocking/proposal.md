# Proposal

> **阅读边界：形成时快照。** 本文件是从已停止维护的 draft Change 迁入调查主题的历史附件，不是当前 Change、plan 或实施授权。当前长期方向分别由[Runner 生产边界结果协议](../../../../../docs/decisions/test-evidence-review/standardize-runner-results-at-producer-boundaries.md)与[正式结果证据资格](../../../../../docs/decisions/test-evidence-review/qualify-formal-results-by-evidence-integrity.md)拥有；旧的[统一测试结果延期决策](../../../../../docs/decisions/test-evidence-review/defer-standard-test-result-blocking.md)已经归档，只是两条当前演进链的共同历史前序。本文中的协议字段、状态、runner 映射、迁移顺序和验证细节均保持形成时的候选含义。

本资源保存“为什么正式测试需要阻断资格”以及一套形成时可供比较的统一 JSON 方案。未来 agent 只能把它作为调查输入：先读取当前两个决策 owner 并核对届时事实，再重新形成 plan，不能直接执行本文或 `tasks.md` 中的历史内容。

## Why

- 形成该材料时，项目门禁主要消费测试容器的聚合退出码，无法区分可追溯的行为失败、未绑定测试、身份错配和 runner 故障。
- 测试只有在意义可描述、可审计并能关联语义 Case 时，才有资格约束实现；否则测试本身的完整性问题会被误报成行为回归。
- Bun、Node 和未来 runner 的原生输出不同。让 test-evidence 核心逐个适配会持续扩大公共行为面，因此需要先比较一个 runner 无关的共同结果边界。

## Outcome

以下内容是形成时提炼出的方向摘要，不是当前契约；发生差异时，协议边界以[Runner 生产边界结果协议](../../../../../docs/decisions/test-evidence-review/standardize-runner-results-at-producer-boundaries.md)为准，资格与行为阻断边界以[正式结果证据资格](../../../../../docs/decisions/test-evidence-review/qualify-formal-results-by-evidence-integrity.md)为准：

1. 若未来建立正式测试资格门禁，各 runner 在生产边缘输出统一、版本化的 JSON 结果，test-evidence consumer 不解析 runner 原生格式。
2. JSON 以 Test ID 标识测试实体，不保存 Case ID。Consumer 先汇报有问题的测试实体，再从权威账本关系派生关联 Case ID。
3. 只有身份和关系有效的 Test 结果才形成行为 pass/fail；无法追溯或协议不合格的正式结果硬阻断为测试完整性问题，不形成行为回归。
4. Test 实体和 Case 都不保存单次运行状态；pass、fail 和完整性分类只属于一次 invocation。

## Scope

### 形成时的未来重审范围

形成该材料时，下列内容被保留给未来重审；这些候选没有预先确定答案：

- JSON Schema、版本兼容、结果和 producer error、传输方式及诊断结构。
- Test ID、locator、测试发现新鲜度和 revision 证据如何由身份 owner 提供。
- Runner-specific producer 与 runner-agnostic consumer 的接口和责任边界。
- 稳定 `test:*`、quick/full check 与 CI 如何在显式试点范围内接入同一资格语义。
- Test、Case 和关系删除时如何保持闭合，并继续由代码审查判断完整自洽删除是否合理。

### 形成时未纳入范围

- 不修改测试框架、producer、consumer、manifest、test-evidence、check 或 CI 行为。
- 不在测试源码、runner 输出或独立 manifest 中建立第二份 Case 关系真源。
- 不从 TAP、JUnit、console 文本、显示名、路径或退出码猜测 Test ID 或 Case ID。
- 不给 Case 增加 pass/fail、覆盖率、权重、顺序、AND/OR 或 quorum 等运行聚合语义。
- 不用任意进程监控或脚本名称推断隐藏测试。

## 形成时的重启条件

只有以下条件同时成立，才重新判断是否进入 plan：

1. 出现明确的正式测试阻断需求、实施优先级和授权。
2. Test ID、locator、真实测试发现及 Test–Case 关系已经成为可消费的当前事实。
3. 至少一个真实 runner 能提供可核对的逐 Test 结果与身份绑定证据。
4. 重新核实现行测试入口、账本、check、CI 和 owner 边界；调查数量与旧任务状态不得直接复用。

满足这些条件只允许重新规划，不自动授权实施。新的 plan 必须重新写明 Schema、试点、迁移、失败分类和验证出口。

## 可能受影响的 Owner

下表只用于未来重审时定位责任，不表示当前 owner 已获得新行为：

| Owner | 未来可能承担 | 不应承担 |
| --- | --- | --- |
| Test 身份与发现 owner | Test ID、locator、真实测试发现、新鲜度和 revision 证据 | JSON 消费和 Case 关系解释 |
| `skills/test-evidence-review/` 与可分发工具 | 统一协议消费、Test → Case 查询、资格分类和诊断 | Runner 原生事件读取 |
| Runner 侧 producer | 读取原生结果、绑定 Test ID 并输出统一 JSON | 查询或输出 Case ID |
| 项目 check 编排 | 资格前置、步骤分类、producer/consumer 编排和最终门禁 | 复制协议 Schema 或解析 runner 格式 |
| CI | 调用并展示项目统一门禁 | 生产、转换或重新解释测试结果协议 |
