# Decision Records

`decision-records` 帮助 agent 在长期判断形成或出现冲突时恢复当前决定、识别约束、区分一次性例外与长期修订，并维护能够继续使用和回放的决策记录。受控领域与稳定路径表达责任归属，自包含 Markdown 保存完整判断，JSON 索引提供查询视图。

它关注“项目已经决定往哪里走，以及决策目标是否已经核对并建立为当前基线”。通用知识、任务日志、进度状态和当前实现事实继续由各自 owner 承接。

## 核心内容

1. Skill 入口面向 agent，承接决策恢复、相关性判断、候选门槛、动作选择和交付验收。
2. 领域契约承接决策内容、稳定身份、生命周期、关系和维护不变量，不复述索引运行时或完整 CLI 协议。
3. `decision-domains.json` 与决策 Markdown 是权威来源；索引只提供可重建查询视图。
4. 活动决策在激活后生效；对齐状态表示完整目标是否已经结合当前事实来源核对为基线，不表示任务进度或额外许可。
5. 编辑性修正保留原记录；决策语义变化时创建能够独立使用的新记录，并通过单次 CLI 事务归档直接前序、保存关系和建立新记录。
6. Git `HEAD` 不决定决策生命周期，但会在归档未提交记录前触发无写入预警；调用者可以显式保留历史，或由 `evolve` 折叠一个简单中间前序并声明完整最终关系集合。

## 内容入口

- [`SKILL.md`](../../skills/decision-records/SKILL.md) 是 agent 的行为入口。
- [`decision-record-rules.md`](../../skills/decision-records/references/decision-record-rules.md) 是 agent 写入前读取的决策领域契约。
- [`maintenance-recovery.md`](../../skills/decision-records/references/maintenance-recovery.md) 只处理工具、索引和中断写入的故障恢复。
- [`decision-index.schema.json`](../../skills/decision-records/references/decision-index.schema.json) 是索引精确机器结构的 owner。
- 随包 CLI 的 `--help` 提供当前命令参数；实现和校验承接精确输出、退出状态和索引操作。
