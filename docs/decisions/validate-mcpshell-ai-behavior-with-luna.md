---
title: 用少量 Luna 调用验证 MCPShell skill 的 AI 行为
status: active
alignment: aligned
createdAt: 2026-09-03T13:31:23Z
purpose: 允许对 MCPShell skill 进行低频 AI 行为验证，同时让可机械证明的 MCP 集成继续由确定性入口承担。
background: 工具注册、列举和协议调用无需消耗模型调用；只有触发、工具选择和任务延续等 AI 判断需要真实模型证据。
decision: 仅为不能机械证明的 AI 行为少量调用 Luna；MCP 结构与调用优先机械验证，不建立重复真实测试矩阵。
tags:
  - mcpshell-workspace-tools
  - skill-maintainer
relations: []
---

## 目的

- 允许维护者直接验证 AI 是否会发现并正确使用 `mcpshell-workspace-tools`，而不把模型调用扩张成常规集成测试手段。
- 用最少的真实模型证据覆盖机械协议不能证明的触发、工具选择和原任务延续行为。

## 背景

- Codex CLI 和 MCP 协议可以机械检查 server 注册、tool 列举、输入 schema、调用结果与失败 envelope；这些事实不需要模型参与。
- Skill 的自然触发、agent project 与目标 project root 的区分、shell/patch/put/get 的选择以及初始化后继续原任务，属于 AI 行为，单靠协议模拟不能完整证明。
- 真实模型调用具有时间和资源成本，重复执行相同场景不会按比例增加信心；本 skill 当前只需要小规模前向验证。

## 决策

- 采用: 仅在验证机械入口无法证明的 AI 行为时，直接调用环境中的 Codex，并固定使用 Luna 模型。
- 采用: 每轮选择能够区分目标行为的最小现实场景，默认一次；只有首次结果无法判断具体原因时才追加一次诊断调用，不为模型、平台或措辞建立组合矩阵。
- 采用: MCP registration、server 启动、tool 列举、schema 和确定性调用优先通过 `codex mcp`、MCPShell CLI 或最小 MCP 协议客户端机械验证；能够机械证明的部分不再用 Luna 重复证明。
- 采用: 模型验证在隔离的临时 agent project 和目标 project root 中运行，不连接生产主机，不使用真实凭据，也不因测试授权扩大到安装依赖或修改外部配置。
- 采用: 交付证据分别记录机械 smoke 与 Luna 行为结果，不把其中一类证据表述为另一类已经通过。
