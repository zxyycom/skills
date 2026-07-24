# Decision Records

`decision-records` 用自包含 Markdown 保存已经生效的重要长期判断、生命周期、对齐状态、形成背景、采用方向和演进关系，并从这些文件确定性生成 JSON 查询索引。

它关注“项目已经决定往哪里走，以及决策目标是否已经核对并建立为当前基线”。通用知识、任务日志、进度状态和当前实现事实继续由各自 owner 承接。

## 核心内容

1. 每条决策 Markdown 是自身状态与语义的事实源，JSON 索引只是可重建的查询投影。
2. 活动决策在激活后生效；对齐状态表示完整目标是否已经结合实际 owner 和事实核对为当前基线，不表示任务进度或额外许可。
3. 编辑性修正保留原记录；决策语义变化时创建新的完整记录，并保存真实演进关系。
4. agent 的恢复、审阅和维护流程由 skill 入口承接，格式、状态、索引和 CLI 的精确行为由固定契约承接。

## 内容入口

- [`SKILL.md`](../../skills/decision-records/SKILL.md) 承接 agent 的行为与交付。
- [`decision-record-rules.md`](../../skills/decision-records/references/decision-record-rules.md) 是记录格式、状态、关系、索引和维护事务的唯一固定契约。
- [`maintenance-recovery.md`](../../skills/decision-records/references/maintenance-recovery.md) 只处理工具、索引和中断写入的故障恢复。
- [`decision-index.schema.json`](../../skills/decision-records/references/decision-index.schema.json) 提供机器可读的索引结构。
