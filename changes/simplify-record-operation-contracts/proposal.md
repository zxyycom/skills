# Proposal

精简 Decision Records 与 Investigation Report 的默认操作责任，以一万条存量、常数规模输入为代表场景；保留领域约束、事务保护和独立暂存能力。

## Why

局部操作同时承担起草预检、全集来源验证、来源重建或维护后全量检查，使少量输入也付出明显的存量成本。[全操作调查](../../docs/investigations/record-tools-all-operations-100k.md)提供了十万条极端规模的历史证据；本 Change 从产品责任上减少这些工作，收益以一万条重新验证。

## Outcome

**普通操作保证声明范围内的结果，当前全集健康由显式检查与同步承担。**

保持 Markdown 权威来源、现有架构和索引格式，使起草、搜索、普通维护与独立暂存各自承担必要工作；调用者能够区分局部成功、发布快照事实和当前全集检查结果。

## Scope

### Intended Change

采用以下 S1–S5，行为与实现边界由 [design](design.md#intended-change) 承接。

| 方案 | 目标行为 | 保证边界 |
| --- | --- | --- |
| S1 候选轻量化 | `new` 安全创建；`show-candidate` 核对所选候选与直接依赖 | 全局冲突由正式发布门禁确认 |
| S2 普通维护采用发布基线 | 核对选中来源、必要依赖与最终发布图 | 无关来源的未同步问题由显式检查／同步发现 |
| S3 文本搜索专注文本发现 | 发布索引选范围，匹配相应当前文本，提前判断候选预算 | 未同步新增和筛选变化不进入发布范围；索引不可用时明确恢复 |
| S4 按交付目标安排验收 | 需要审阅影响时预检，需要全集结论时全量检查 | 局部成功只表达本次覆盖的保证 |
| S5 独立暂存按选择刷新 | 选中 ID 按 scope 更新为当前完整版本，未选 pending 保持不变 | 保留依赖闭合、并发保护；以现有组合机制实现 |

### Resulting Impacts

- 两域 skill、CLI／SDK、恢复手册和调用流程同步新的保证、来源解释与诊断。
- 暂存覆盖三种 scope、连续刷新、未选 pending 保护、旧位置清理和原子失败。
- 受影响的行为测试、Case、skill 版本及分发产物同步交付；其他共享消费者保持既有契约。

## Success Criteria

1. 起草和候选读取独立于无关正式来源；自身输入、路径和直接依赖问题准确反馈。
2. 普通维护保留身份、生命周期、必要关系、写前漂移与恢复保护；全量检查仍能发现被延后的来源问题。
3. content 搜索准确表达发布范围与当前文本，区分预算拒绝、读取失败和零命中；索引不可用时走显式恢复。
4. 独立暂存支持单个／多个 ID、连续暂存和重复刷新；未选 pending 保持，缺失依赖提示补选，并发漂移拒绝写入。
5. 健康样本的结果保持一致，保证变化有对应行为证据；实际改动通过编码规范、Case、生成与项目门禁。
6. 在一万条存量、常数规模输入下对照受影响操作的完整耗时、内存和实际效果，保存可复核的调查结论及证据。

## Affected Owners

| Owner | 实施阶段责任 |
| --- | --- |
| [Decision Records](../../skills/decision-records/SKILL.md)、[领域规则](../../skills/decision-records/references/decision-record-rules.md)、[CLI 契约](../../skills/decision-records/references/cli-operations.md)、[恢复手册](../../skills/decision-records/references/maintenance-recovery.md) | 决策流程、操作保证与恢复 |
| [Investigation Report](../../skills/investigation-report/SKILL.md)、[固定契约](../../skills/investigation-report/references/investigation-report-contract.md)、[CLI 契约](../../skills/investigation-report/references/cli-operations.md)、[恢复手册](../../skills/investigation-report/references/maintenance-recovery.md) | 报告、资源、操作保证与恢复 |
| [决策工具维护](../../tools/decision-records/README.md)、[调查工具维护](../../tools/investigation-report/README.md)及对应源码／测试 | CLI／SDK、领域实现与行为证据 |
| [记录维护工作流](../../docs/record-maintenance-workflow.md)及其领域页 | 按需预检与集合级验收的调用条件 |
| [Index Runtime](../../tools/index-runtime/README.md)、[版本管理](../../tools/shared/version-control.md)、`tools/shared/` | 共享不变量与消费者兼容 |
| [项目工具链](../../docs/tooling.md)、[编码规范](../../docs/coding-style.md) | 源码／生成边界、版本、分发与质量门禁 |
| [Test Evidence Review](../../skills/test-evidence-review/SKILL.md)、`docs/test-evidence/` | 最小原生测试入口、Case 与派生索引 |
