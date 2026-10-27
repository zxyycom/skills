# Task Graph 分段暂存契约

本参考定义按 task ID 构造 Git pending 索引的精确规则；调度与授权见 [Task Graph](../SKILL.md)。

## 合成与写入

1. 本节的 Git `pending` 指下一次提交使用的待提交快照，不是工作区 task index 或 task execution state。`index stage` 只替换该快照中的 task index 路径；工作区索引、任务状态和索引外路径保持不变。
2. CLI 至少提供一次 `--task <id>`，选择多个 task 时为每个 ID 重复该参数，例如 `index stage --task task-000001 --task task-000002`。ID 必须规范且不重复。程序化调用使用 `TaskGraphService.stageTaskIndex(taskIds)`。
3. 命令读取当前 Git `HEAD` 中的 task index 作为基线；HEAD 尚无该文件时使用当前 Schema 的空索引作为基线。目标工作区中的完整索引是本次候选快照。选中且候选存在的 task 使用候选条目；选中且只在基线存在的 task 被删除；未选中 task 保持基线条目。指定 ID 在两端都不存在时拒绝。
4. 根级 `revision` 和 `nextTaskId` 描述完整 task index，不能归属单个 task。目标始终使用候选快照的两个水位，并拒绝相对基线回退；即使水位来自未选中 task 的变化，也不从目标中剥离。
5. 合成目标重新通过完整 Schema、语义和关系校验，再由规范 serializer 产生 canonical JSON。父子、依赖、对称排斥或生命周期约束无法在合成索引中成立时整批拒绝；命令不会为修复关系而自动扩大选择集。
6. 版本管理锁内同时确认 Git `HEAD` 仍是已读取的 commit，且该索引路径的既有 pending 快照的字节与文件表示仍等于 HEAD 基线；HEAD 没有该文件时，该路径必须尚未进入 pending。另一批已暂存 task、并发 pending 写入或 HEAD 变化都返回 `REVISION_CONFLICT`，不累加、不合并、不覆盖；索引外 pending 路径保持不变。
7. 默认实际 `index stage` 使用单行稳定文本；显式全局 `--json` 返回同一 raw result。成功结果的顶层 `revision` 是目标 task index 的根级 revision，`state` 与 `changed` 分别只能组成 `staged`/`true` 或 `unchanged`/`false`。该命令需要可发现的 Git 仓库，但不加载工作区索引 mutation 的 native runtime；成功只证明 pending 快照已写入，不表示已经 commit、push 或交付。
