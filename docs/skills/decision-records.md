# Decision Records

`decision-records` 用受控领域目录和自包含 Markdown 保存重要长期判断、生命周期、对齐状态、形成背景、采用方向和演进关系，并从领域目录表与全部已建立文件确定性生成 JSON 查询索引。路径第一段同时表达唯一领域分类与稳定身份，使领域边界、文件位置和查询视图保持一致。决策根目录不要求位于 Git 仓库。

它关注“项目已经决定往哪里走，以及决策目标是否已经核对并建立为当前基线”。通用知识、任务日志、进度状态和当前实现事实继续由各自 owner 承接。

## 核心内容

1. `decision-domains.json` 定义当前集合允许使用的稳定责任领域及其边界；索引 metadata 为读取方提供完整派生视图。
2. 每条决策 Markdown 直接位于一个领域目录，并作为自身状态与语义的事实源；`createdAt: null` 的完整新记录是未生效候选，合法非空 `createdAt` Markdown 是已建立记录。
3. 活动已建立决策在激活后生效；对齐状态表示完整目标是否已经结合实际 owner 和事实核对为当前基线，不表示任务进度或额外许可。
4. JSON 索引只是全部已建立 Markdown 的可重建查询投影；索引外新增已建立文件会使查询拒绝陈旧结果，同步后自动成为正常成员。
5. 编辑性修正保留原记录；决策语义变化时创建新的完整记录，并保存真实演进关系。
6. agent 的恢复、审阅和维护流程由 skill 入口承接，格式、状态、索引和 CLI 的精确行为由固定契约承接。

## 内容入口

- [`SKILL.md`](../../skills/decision-records/SKILL.md) 承接 agent 的行为与交付。
- [`decision-record-rules.md`](../../skills/decision-records/references/decision-record-rules.md) 是领域选择、记录格式、状态、关系、索引和维护事务的唯一固定契约。
- [`maintenance-recovery.md`](../../skills/decision-records/references/maintenance-recovery.md) 只处理工具、索引和中断写入的故障恢复。
- [`decision-index.schema.json`](../../skills/decision-records/references/decision-index.schema.json) 提供机器可读的索引结构。
