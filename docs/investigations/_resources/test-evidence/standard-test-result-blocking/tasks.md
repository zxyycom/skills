# Tasks

> **阅读边界：形成时快照，没有可执行任务。** 本文件是从已停止维护的 draft Change 迁入调查主题的历史重启清单，不是当前 backlog、路线图、Change tasks 或实施授权。后续 agent 不得根据本文件直接开始工作。

## 当前 Owner 与历史状态

- 当前长期方向分别由[Runner 生产边界结果协议](../../../../../docs/decisions/test-evidence-review/standardize-runner-results-at-producer-boundaries.md)和[正式结果证据资格](../../../../../docs/decisions/test-evidence-review/qualify-formal-results-by-evidence-integrity.md)拥有；两者均为 `active + unaligned`，不表示当前行为、排期或实施授权。
- 旧的[统一测试结果延期决策](../../../../../docs/decisions/test-evidence-review/defer-standard-test-result-blocking.md)已经归档，只是两条当前演进链的共同历史前序。
- 原 Change 在本材料形成时是长期延期的 `draft`，后来停止作为 Change 维护；因此这里不存在可恢复或继续执行的当前 Change stage。
- 当前实现事实必须从测试、test-evidence、check 和 CI 的各自 owner 重新核对，不能从本历史清单推断。

## 形成时的重启门槛

重新规划前必须同时确认：

1. 用户或产品 owner 提出了真实阻断需求，并明确给出优先级与实施授权。
2. Test ID、locator、真实测试发现和 Test–Case 关系已经可由当前 owner 稳定提供。
3. 至少一个真实 runner 能证明原生结果与 Test ID 一一对应，并能完整报告本次实际 Test 结果。
4. 已重新核对当前测试入口、账本、check、CI、依赖和 owner；旧调查数量、任务状态及 Schema 假设只作为线索。

任一条件不成立时，形成时方案要求继续延期。今天若要推进，必须先按当前决策 owner 和仓库事实重新选择工作；本清单本身不产生实现任务。

## 重新选择推进后的第一个交付

重新选择推进且复核形成时门槛后，应建立基于届时事实的全新可审阅 plan，而不是续写这些历史附件。新 plan 至少需要决定：

- JSON Schema、版本、结果分类、producer error、传输和诊断边界。
- Producer、consumer、Test 身份、账本、check 与 CI 的单一 owner 分工。
- 试点范围、迁移顺序、停止条件，以及身份非法、集合不闭合、来源漂移和 runner 故障的验证矩阵。

这些决定完成并再次获得实施授权前，不修改测试框架、runner、test-evidence、check 或 CI。
