---
title: 按平台建立 Hook 并允许短入口显式切换项目
status: archived
alignment: aligned
createdAt: 2026-08-09T04:47:47Z
purpose: 让仓库自举按 Git 平台语义启用 hook，并让短入口在安全默认值之外显式选择其他项目。
background: POSIX 执行位不是 Git for Windows 的启用机制，隐藏绝对 root 和完全禁止 root 都偏离当前项目默认语义。
decision: Hook 同时维护 LF、POSIX mode 与 hooksPath；task-graph 从当前 Git 项目发现默认 root，并接受一个显式项目 root。
tags:
  - project-tooling
relations:
  - type: 修订
    target: bootstrap-repository-coordination-with-owned-launchers.md
---

## 目的
- 让 clone 和 linked worktree 通过标准环境入口获得符合当前 Git 平台的 hook 条件，并让同一个非交互短入口既有不会分叉的当前项目默认值，又能明确切换到其他项目。

## 背景
- POSIX Git 会因 hook 缺少执行位而忽略它；原生 Git for Windows 的兼容层不使用 POSIX `X_OK` 判定，脚本换行、文件存在和 `core.hooksPath` 才是相应平台边界。
- Linked worktree 默认按自身目录解析 task root 会分叉索引，但持久化绝对 root 可能陈旧，完全禁止 `--root` 又让调用者无法有意切换项目；可恢复默认值和显式选择应当分别处理。
- 交互式 alias、用户级 PATH 和临时环境变量不能稳定覆盖 Windows、Linux 与非交互 Codex 命令。

## 决策
- 采用: Hook 源以 LF 和 Git index executable mode 进入版本管理；setup 始终配置当前 worktree 的 `core.hooksPath`，只在 POSIX 恢复文件执行位，在 Windows 依赖 Git for Windows 的存在性语义并用真实 Git 调用验收。
- 采用: 环境入口继续使用只读 `environment.js check` 与有副作用的 `environment.js setup`；当前项目默认 task root 每次从短入口所在 Git 仓库发现为主 worktree，不持久化绝对项目路径。
- 采用: task-graph 短入口省略 root 时使用上述当前项目默认值；调用者提供唯一显式 root 时，相对短入口所在 worktree 解析并切换到目标项目自己的 CLI 与 canonical index。缺值、重复 root、失效项目或任何 index override 均失败关闭。
- 不采用: 把 `chmod` 描述为所有平台的统一启用机制、保存隐藏的绝对默认 root、禁止全部显式 root，或让显式选择仍调用默认项目的 CLI；这些做法分别混淆平台语义、引入陈旧状态、限制合法多项目使用或混合工具版本责任。
