---
title: 按平台建立 Hook 并统一仓库维护短入口
status: active
alignment: aligned
createdAt: 2026-08-09T05:09:37Z
purpose: 让仓库自举按 Git 平台语义启用 hook，并让本仓库通过稳定短入口调用实际使用的 skill 维护 CLI。
background: POSIX 与 Git for Windows 的 hook 条件不同，隐藏绝对 root 会陈旧，而重复 skill 脚本路径不能形成稳定的项目调用约定。
decision: Hook 按平台建立条件；仓库维护 CLI 由 package scripts 委托既有领域入口，task-graph 额外负责安全的项目 root 选择。
relations:
  - type: 修订
    target: project-tooling/bootstrap-hooks-and-select-project-roots.md
---

## 目的
- 让 clone 和 linked worktree 通过标准环境入口获得符合当前 Git 平台的 hook 条件，让 task-graph 默认共享当前项目中央索引，并让本仓库的日常维护命令不再重复 skill 安装路径。
- 保持 package 短入口与 skill 可分发 CLI 的责任分离：项目内获得一致、非交互的调用方式，仓库外使用者仍按 skill 自身说明定位脚本。

## 背景
- POSIX Git 会因 hook 缺少执行位而忽略它；原生 Git for Windows 的兼容层不使用 POSIX `X_OK` 判定，脚本换行、文件存在和 `core.hooksPath` 才是相应平台边界。
- Linked worktree 默认按自身目录解析 task root 会分叉索引，但持久化绝对 root 可能陈旧；默认项目发现与显式项目切换需要分别处理。
- 多个随 skill 分发的稳定 CLI 已用于本仓库维护。反复书写 `skills/*/scripts/` 路径会把安装布局泄漏到日常命令，临时 shell alias、用户级 PATH 和环境变量又不能稳定覆盖 Windows、Linux 与非交互 Codex 命令。

## 决策
- 采用: Hook 源以 LF 和 Git index executable mode 进入版本管理；setup 始终配置当前 worktree 的 `core.hooksPath`，只在 POSIX 恢复文件执行位，在 Windows 依赖 Git for Windows 的存在性语义。
- 采用: 环境入口使用只读 `environment.js check` 与有副作用的 `environment.js setup`；不持久化绝对项目路径。
- 采用: 本仓库实际用于日常维护且拥有稳定分发 CLI 的 skill，由 `package.json` 提供语义对应的 `bun run <command> -- <arguments>` 短入口。入口直接委托现有生成 CLI，不复制参数、输出、退出状态或事务逻辑；项目校验和命令级测试防止入口缺失或失效。
- 采用: 项目协作入口与工具链说明要求仓库内优先使用短命令；只有验证源码与生成产物边界、调试入口实现或编写仓库外可移植说明时使用完整路径。skill 内存在脚本本身不足以自动获得项目别名。
- 采用: task-graph 短入口额外承担项目 root 选择；省略 root 时发现当前 Git 项目主 worktree，唯一显式 root 切换到目标项目自己的 CLI 与 canonical index。缺值、重复 root、失效项目或任何 index override 均失败关闭。
- 不采用: 把 `chmod` 当作全平台启用机制、保存隐藏绝对 root、为所有 skill 脚本批量造别名，或让 package 入口形成第二套领域契约；这些做法会分别混淆平台语义、引入陈旧状态、扩大无实际消费的维护面或造成行为分叉。
