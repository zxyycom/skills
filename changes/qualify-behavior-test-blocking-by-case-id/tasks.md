# Tasks

> **当前没有可执行任务。** 本文件只保存未来是否重启本 change 的判断入口，不是 backlog、路线图或实施清单。后续 agent 不得根据未完成复选框或旧设计顺序直接开始工作。

## 当前状态

- Change stage 是 `draft`。
- 长期方向已记录为 `active + unaligned`，表示它是未来选择输入，不是当前行为、排期或实施承诺。
- 现行测试、test-evidence、check 和 CI 行为均未因本 change 改变。

## 重启门槛

重新规划前必须同时确认：

1. 用户或产品 owner 提出了真实阻断需求，并明确给出优先级与实施授权。
2. Test ID、locator、真实测试发现和 Test–Case 关系已经可由当前 owner 稳定提供。
3. 至少一个真实 runner 能证明原生结果与 Test ID 一一对应，并能完整报告本次实际 Test 结果。
4. 已重新核对当前测试入口、账本、check、CI、依赖和 owner；旧调查数量、任务状态及 Schema 假设只作为线索。

任一条件不成立时，保持 draft，不创建实现任务。

## 重启后的第一个交付

满足重启门槛后，先重写 proposal、design 和 tasks，使它们基于届时事实形成新的可审阅 plan。新 plan 至少需要决定：

- JSON Schema、版本、结果分类、producer error、传输和诊断边界。
- Producer、consumer、Test 身份、账本、check 与 CI 的单一 owner 分工。
- 试点范围、迁移顺序、停止条件，以及身份非法、集合不闭合、来源漂移和 runner 故障的验证矩阵。

这些决定完成并再次获得实施授权前，不修改测试框架、runner、test-evidence、check 或 CI。
