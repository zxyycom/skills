---
title: 为 task-graph 短命令选择项目 Root
status: active
alignment: aligned
createdAt: 2026-08-09T05:40:36Z
purpose: 让 task-graph 短命令默认使用当前项目中央索引，同时允许调用者显式切换目标项目。
background: Linked worktree 按自身目录操作会分叉任务索引，持久化绝对 root 会陈旧，而完全禁止显式 root 会阻止合法的多项目操作。
decision: 默认从短命令所在 Git 项目发现主 worktree；唯一显式 root 切换到目标项目自己的 CLI 和 canonical index。
tags:
  - project-tooling
relations:
  - type: 拆分
    target: bootstrap-hooks-and-use-project-short-commands.md
---

## 目的
- 让同一 Git 项目的主 worktree 和 linked worktree 默认共享一个 task-graph 事实源，并让有意进行的跨项目操作保持显式、可校验。

## 背景
- task-graph 以项目 root 解析 canonical index；linked worktree 若使用自身目录，会形成相互独立的索引。
- 保存主 worktree 绝对路径会随仓库移动或重新创建而陈旧。
- 调用者有时需要从当前仓库入口操作另一个完整项目，不能把该选择退化为隐藏配置或任意 index override。

## 决策
- 采用: 省略 `--root` 时，task-graph 短命令每次从其所在 Git 项目发现主 worktree，不持久化绝对项目路径。
- 采用: 提供唯一 `--root <path>` 或 `--root=<path>` 时，相对路径以短命令所在 worktree 为基准，并切换到目标项目自己的 CLI 与 `docs/task-graph/task-graph-index.json`。
- 采用: root 缺值、重复、目标项目缺少 CLI 或 canonical index 时失败关闭；短命令拒绝 `--index`，需要其他索引时直接调用领域 CLI。
