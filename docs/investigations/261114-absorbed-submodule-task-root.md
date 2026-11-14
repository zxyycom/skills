---
title: "Absorbed submodule 环境任务根发现失败"
id: "261114-absorbed-submodule-task-root"
formedAt: "2026-11-14T08:17:06Z"
question: "为何 absorbed submodule 的环境 setup 找不到任务索引，如何保持 linked worktree 的中央根语义？"
tags:
  - "git"
  - "repository-tooling"
relations: []
---

## 形成时背景

2026-11-14，Windows 子仓 `app/skills` 的 `win` 分支在 `925de860` 上执行标准环境 setup 时，主代理报告任务索引缺失。现场是正常 absorbed submodule；任务要求保留 linked worktree 的中央任务根语义，同时不得因任务索引缺失而猜测其他根。调查和修复不涉及资源领域设计。

## 调查目的

确认 Git 主工作区发现为何落到 Git 元数据目录、如何正确识别普通仓和 submodule 的主工作区，以及 linked worktree 和缺失索引的失败边界。

## 调查范围与依据

检查 `scripts/setup-repository.js`、环境测试及工作区环境约定。只读现场 Git 输出显示 `git worktree list --porcelain` 首条为父仓 `.git/modules/app/skills`，`git rev-parse --show-toplevel` 为实际 `app/skills`，本地 `core.worktree` 为相对公共 Git 目录的工作树路径。原实现直接采用首条记录，因而在元数据目录检查任务索引。真实 Git 临时 fixture 分别建立普通仓、absorbed submodule 和各自 linked worktree，比较显式已知主工作区与发现结果，并移除主工作区的任务索引验证失败。原现场仅只读调用根发现；实际 setup 由主代理在修复后执行并报告成功。

同日 Kant 的独立审核在 Windows Git 2.54 的真实 absorbed submodule 中发现：`git sparse-checkout set docs scripts` 启用 `extensions.worktreeConfig` 并将主工作区 `core.worktree` 从公共 local 配置迁入主工作区的 `config.worktree`，初次修复因此在主工作区和 linked worktree 均失败。后续真实 Git fixture 执行相同迁移，确认 local 中缺少该值、linked 的 `--worktree` 也不提供该值，并分别验证两个 checkout 的根发现。

## 调查结果与边界

当首条 worktree 路径等于 Git 公共目录时，修复在启用 worktree 配置时优先读取公共 Git 目录下主工作区的 `config.worktree`，否则或该值不存在时读取公共 local 配置，以 `core.worktree` 相对于公共目录解析主工作区；其他布局沿用首条主 worktree。缺失配置或真实主工作区任务索引时仍失败，不按索引存在性 fallback。Windows 定向 fixture 测试通过，实际子仓根发现返回 `app/skills`；主代理报告真实 Windows 标准 setup 在首轮修复后锁定 pnpm 依赖、CodeGraph、hook 和 task root 均 ready，后续 sparse 修订仅在隔离 fixture 验证。该报告不是对其他 Git 版本、平台或裸仓布局的全面兼容证明；出现不同 `worktree list` 布局、主工作区路径配置缺失或索引真实缺失时，应重新检查 Git 配置与工作区，而非切换到 linked worktree 的索引。

2026-11-14 环境完整测试集以 30 秒单测超时复跑 24 项通过；首次默认 5 秒运行有一项超时并影响下一项，另发现并修正了既有 Windows 路径分隔符断言。定向格式检查通过。后续 sparse 修订的定向 fixture 测试通过，设置了 30 秒显式超时；全仓类型检查仍受并行资源实现中的错误阻断。
