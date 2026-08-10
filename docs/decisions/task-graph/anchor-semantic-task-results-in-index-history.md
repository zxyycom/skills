---
title: 以索引历史锚定 task 语义结果
status: active
alignment: aligned
createdAt: 2026-08-10T07:20:56Z
purpose: 让 task result 保存可维护的语义结果，并由 task index 的版本历史锚定完成时的仓库状态。
background: 分支 SHA 会被 rebase 改写，而 task 协调没有明确消费者需要在 result 中重复保存具体实现提交。
decision: Task result 默认只保存摘要和稳定 owner 引用；完成状态进入 task index 的 Git 历史后锚定仓库版本，不常规记录 commit SHA。
relations: []
---

## 目的

- 让 task result 表达当前协调所需的语义结果, 而不复制由 Git 自身维护、可能在集成中改变的提交身份。
- 让任务完成状态与仓库版本仍可追溯, 同时不把 task index 扩展为代码提交映射或结果校正日志。

## 背景

- 子代理分支提交在 rebase、重排、压缩或冲突处理后会获得新的身份; Git 不提供可长期依赖的旧提交到新提交映射。
- Task graph 是当前协调事实源, 不是提交审计账本。当前没有明确消费者需要从每个 task result 精确解析唯一实现提交; 结果摘要、稳定 owner 引用和 task index 自身的版本历史已经覆盖实际恢复需要。
- 即使等到主线集成后再写最终 commit SHA, result 仍会重复 Git 身份, 并让任务收敛与具体提交字段形成不必要的跨 owner 耦合。

## 决策

### Result 内容

- 采用: Task result 默认只保存结果摘要和确有长期价值的稳定 owner 引用, 不常规保存分支或主线 commit SHA。
- 采用: 分支、当前提交和验证证据属于集成交接输入, 不进入长期结果引用。
- 采用: 只有未来出现定义清楚的实际消费者和独立验收时, 才重新评估精确提交引用能力。

### 版本锚点

- 采用: 包含终态 entry 的 task index 变化只有进入 Git 历史后才形成版本锚点。
- 采用: 该锚点只证明仓库版本已经记录任务结果, 不宣称 task 唯一对应某个实现提交。
- 采用: 工作区 mutation、pending 快照和 Git commit 保持各自边界。

### 集成与终态边界

- 采用: Task goal 包含主线集成时, 分支实现、自验证和提交仍只是中间交付。即时集成可以续租交接并在合并后完成同一 task; 异步集成或独立所有权使用显式依赖的实现与集成 tasks。
- 采用: 成功事实撤销作为独立终态纠正问题处理, failed task 再执行继续使用 retry; 二者都不改写 succeeded result 元数据。
- 采用: 不新增 succeeded result 元数据校正命令, 也不在本判断中回溯修改既有终态结果。历史 task 按剩余协调价值保留, 或通过既有闭合清理门禁删除。

### 不采用

- 不采用: 为每个 succeeded task 复制最终主线 SHA。
- 不采用: 为修复重复的 Git 身份建立包含旧值、新值和原因的第二审计源。
