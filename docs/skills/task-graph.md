# Task Graph

`task-graph` 用工作区内的权威 JSON 索引保存影响当前调度的任务事实，让 agent 能查询、恢复并协调工作。它适合多个候选、动态追加、真实父子分解、非线性依赖、并发排斥或跨上下文恢复；只有少量固定顺序步骤时，当前对话计划通常足够。任务可保留到协调价值消失；它不替代长期知识 owner。

## 主要行为

任务包含标题、目标、上下文与结果，以及控制状态、执行尝试、租约和关系。父子关系表达真实分解，依赖表达推进条件，排斥防止同时运行；工具从权威事实计算可行动性和阻塞原因。可选的 `acceptance` 是完成提示，不是工具门禁或用户验收。

默认 `task list` 展示全部任务的分层视图；需要完整机器结果时使用 `--json`。工具还支持按 task ID 为下一次提交构造索引的待提交快照；调用方仍负责其他文件、提交和交付。终态结果保存摘要与有长期价值的引用，Git 中首次包含该终态的提交只是记录结果的版本锚点，不证明任务唯一对应某个实现提交。具体输出、暂存和结果契约见 [Task Graph skill](../../skills/task-graph/SKILL.md#task-list-输出与程序化边界)、[分段暂存](../../skills/task-graph/SKILL.md#按-task-id-分段暂存索引)和 [result 契约](../../skills/task-graph/SKILL.md#task-result-与版本锚点)。

## 能力与授权边界

- 工作区 `docs/task-graph/task-graph-index.json` 是唯一权威索引，只由工具事务化修改；查询投影不构成第二份状态。
- 工具协调任务，不自动推断业务关系或优先级；明确 change 的持久规划由 `change-plan` 承接，执行者的选择和审计不由任务图负责。
- 排队、领取或租约不授予文件写入、外部系统调用、不可逆操作、子代理创建、提交或发布权限。工作区修改不自动暂存或提交。
- 工作区索引修改需要 native runtime；只读查询、help、模块导入与 `index stage` 不需要。缺失 runtime 时须先取得 npm 联网和工具目录写入的明确授权，工具不自动安装；不兼容时停止修改。详见[运行前置](../../skills/task-graph/SKILL.md#工具运行前置)和[准备 runtime](../../skills/task-graph/SKILL.md#0-仅为工作区索引-mutation-准备-runtime)。
- 工作区索引的并发锁边界只承诺受测平台上的同主机本地文件系统，详见[权限与并发边界](../../skills/task-graph/SKILL.md#权限与并发边界)。
- 写入结果未知时，先读取并核对相应状态再决定后续动作，不能盲目重放。工作区索引和 Git pending 分别按[错误恢复](../../skills/task-graph/SKILL.md#错误恢复)处理。

## 实际入口

行为、工作流程和权限以 [`skills/task-graph/SKILL.md`](../../skills/task-graph/SKILL.md) 为准。CLI 与程序化入口随 skill 分发；调用前用 `help` 或 `help <command-path>` 获取精确命令、前置和结果契约。工作区恢复从 `index info` 开始，再按需使用 `task list`、`actionable` 和 `task show`；详见[恢复索引与任务图](../../skills/task-graph/SKILL.md#1-恢复索引与任务图)。
