---
title: 由环境自举建立仓库本地协调入口
status: archived
alignment: aligned
createdAt: 2026-08-08T12:37:26Z
purpose: 让每个 clone 和 linked worktree 在标准自举后获得可恢复且不会分叉的仓库协调入口。
background: 交互式 alias 和进程环境不能稳定覆盖跨平台非交互命令，当前目录默认值还可能把中央 task index 分叉到 worker。
decision: 标准 setup 持久化 hook 与中央 task root；仓库 launcher 核对主 worktree 后委托现有 CLI。
relations: []
---

## 目的
- 让每个 clone 和 linked worktree 通过同一标准环境入口获得实际可执行的 Git hook，以及明确指向中央协调位置的短命令。

## 背景
- 只配置 `core.hooksPath` 不能保证新 worktree 中的 hook 文件可执行；把 hook 安装留作独立步骤，会让已经运行环境自举的工作区仍处于不完整状态。
- 交互式 shell alias、用户级 PATH 和单次进程 export 不能稳定进入 Windows、Linux 与非交互 Codex 命令。
- Task Graph CLI 默认按当前目录解析 root 和 index；linked worktree 若省略中央位置，会产生多个相互独立的任务索引。

## 决策
- 采用: 环境入口使用语义完整的 `environment.js check` 和 `environment.js setup`；`check` 保持只读，`setup` 明确拥有依赖准备及仓库本地配置副作用。
- 采用: 标准 setup 恢复当前 worktree 的 hook 可执行权限和 `core.hooksPath`，并在仓库 local Git config 中保存由同仓 linked worktree 共享的主 worktree 绝对路径。
- 采用: 仓库 task-graph launcher 每次调用都重新核对已配置路径与当前主 worktree，拒绝调用方覆盖 root 或 index，再把完整领域行为委托给中央现有 CLI；其他稳定长命令继续由 package scripts 提供短入口。
- 不采用: 只提供 shell alias、临时环境变量或根据调用 worktree 静默推断 task root；这些方式不能形成跨平台、非交互且失败关闭的仓库契约。
