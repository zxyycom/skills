---
title: 仓库内使用维护 CLI 短命令
status: active
alignment: aligned
createdAt: 2026-08-09T05:40:36Z
purpose: 让本仓库通过稳定、可发现的 package scripts 调用实际使用的 skill 维护 CLI，而不重复安装路径或领域契约。
background: 多个随 skill 分发的 CLI 已用于本仓库维护；完整脚本路径泄漏安装布局，交互式 alias、用户级 PATH 和临时环境变量不能覆盖全部运行环境。
decision: 为实际日常使用的稳定领域 CLI 提供 `bun run` 短命令；项目内优先使用短命令，完整路径只用于明确的实现与分发边界。
tags:
  - project-tooling
relations:
  - type: 拆分
    target: bootstrap-hooks-and-use-project-short-commands.md
---

## 目的
- 让 agent、维护说明和人工操作使用同一组跨 shell、非交互且可由项目校验发现的维护命令。
- 保持 package 短命令与可分发领域 CLI 的责任分离，不建立第二套参数、输出或事务契约。

## 背景
- 本仓库日常使用 change、decision、investigation、task、test-evidence 和 skill validation 等领域 CLI。
- 直接书写 `skills/*/scripts/` 路径会让调用方依赖生成制品布局；shell alias、用户级 PATH 和临时环境变量不能稳定进入 Windows、Linux 与非交互 Codex 命令。
- skill 内存在脚本不代表本仓库实际消费该 CLI，为全部脚本自动建立别名会增加无消费者的维护面。

## 决策
- 采用: `package.json#scripts` 为本仓库实际日常使用且拥有稳定分发 CLI 的领域能力提供 `bun run <command> -- <arguments>` 短命令。
- 采用: 除 task-graph 的项目选择 launcher 外，短命令直接委托既有 `skills/*/scripts/` 生成 CLI；参数、输出、退出状态和事务逻辑继续由领域 CLI 定义。
- 采用: 项目内 agent、维护说明和日常人工操作优先使用短命令。只有验证源码与生成制品边界、调试入口实现或编写不依赖本仓库 `package.json` 的分发说明时使用完整路径。
- 采用: 类型化验收映射声明各短命令必须委托的入口，项目配置校验用它核对作为执行事实源的 `package.json#scripts`；命令级测试覆盖映射中的全部入口。新增别名时同步维护工具链命令清单。
