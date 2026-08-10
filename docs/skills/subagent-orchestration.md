# Subagent Orchestration

`subagent-orchestration` 用于用户明确要求委派、并行或独立审查，或者任务耗时长、影响面广、上下文负担重，并且能够拆成边界清楚的调查、实现、验证或审查子任务时。主 agent 负责目标、权限、所有权、依赖和结果审计，子代理负责有界交付。

编排首先控制上下文。工具允许选择历史范围时，默认不继承主线程对话，只传递完成子任务所需的最小背景；确实依赖最近对话时选择最小有限历史，只有完整对话不可替代时才使用全量继承。

并行边界按状态变化划分：可写子任务的文件、配置、生成产物和外部状态所有权必须互斥；只读子任务为了取得独立结论或互补证据可以重叠读取。同一范围需要实现和审查时，先由写入方完成稳定结果，再交给只读 reviewer。

主 agent 派发结果导向的任务，并在返回后只审计目标是否达成、范围是否越界、假设是否可靠、验证是否充分以及是否仍有风险或阻塞。等待较长或结果不足时优先缩小范围、补充只读调查或追加审查，不把子代理退化为逐条执行命令的远程终端。

## 与 task graph 协作

只有工作已经通过 `task-graph` 领取, 且 task goal 包含目标主线集成时, 才启用对应的 Git 集成协作。`task-graph` 负责 lease、终态 result 和版本锚点; 本 skill 只负责代理交接、集成所有权和任务切分。项目没有启用 task graph 时, 沿用项目已有流程, 不自行引入这些概念。

- **即时集成**: 主 agent 会立即继续同一 task 时, 子代理完成分支提交和自验证后续租并交回 task、lease、分支、当前提交和验证结果; 主 agent 集成后再收敛 task。
- **异步集成**: 集成需要等待或由独立所有者负责时, 编排者建立显式依赖的实现 task 与集成 task; 分支、当前提交和验证结果作为交接输入传给集成执行者。

两条路径都把分支提交视为待集成输入, 不把它误当成整个 goal 已经完成。操作顺序和选择条件以实际 [Subagent Orchestration skill](../../skills/subagent-orchestration/SKILL.md#与-task-graph-协作的-git-集成) 为准; result 的内容与 Git 锚点以 [Task Graph skill](../../skills/task-graph/SKILL.md#task-result-与版本锚点) 为准。

实际 skill 位于 [`skills/subagent-orchestration/`](../../skills/subagent-orchestration/)。
