---
title: 按 Git 平台建立仓库 Hook
status: active
alignment: aligned
createdAt: 2026-08-09T05:40:36Z
purpose: 让 clone 和 linked worktree 通过标准环境 setup 获得符合当前 Git 平台的 pre-commit 条件。
background: POSIX Git 使用执行位判断 hook 可用性，Git for Windows 使用不同的可执行性兼容语义，但两者都需要稳定脚本换行和 hooksPath。
decision: Hook 源固定为 LF 并保留 Git executable mode；setup 始终配置 hooksPath，只在 POSIX 恢复工作区执行位。
tags:
  - project-tooling
relations:
  - type: 拆分
    target: bootstrap-hooks-and-use-project-short-commands.md
---

## 目的
- 让每个 clone 和 linked worktree 在运行标准环境 setup 后，都具备由 Git 实际调用的仓库 pre-commit hook。

## 背景
- POSIX Git 会忽略缺少执行位的 hook；原生 Git for Windows 的兼容层不使用 POSIX `X_OK` 判定。
- 跨平台 hook 仍共同依赖脚本存在、LF 换行和仓库 local `core.hooksPath`。
- 环境检查必须保持只读，建立 hook 条件属于明确的 setup 副作用。

## 决策
- 采用: `.githooks/*` 通过 `.gitattributes` 固定为 LF，pre-commit 在 Git index 中保留 executable mode。
- 采用: `environment.js setup` 始终为当前 worktree 配置 `core.hooksPath=.githooks`；只在 POSIX 恢复 hook 工作区执行位，Windows 不把 `chmod` 当作启用机制。
- 采用: `environment.js check` 只报告当前平台缺少的 hook 条件，不写配置或修改文件 mode；真实 `git commit` 是 hook 是否可用的验收入口。
