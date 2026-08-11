---
title: 只将 AI 配置变化归入 ai 提交类型
status: active
alignment: aligned
createdAt: 2026-08-11T03:26:55Z
purpose: 让提交历史能够单独追踪 AI 和 agent 运行配置，同时避免把相关文档与规格泛化为配置变化。
background: AI 能力相关内容既包含运行配置，也包含说明、协作规则、规格和测试；按服务对象分类会掩盖改动的真实语义。
decision: 只有纯 AI 或 agent 配置变化使用 ai；Skill、协作规则、OpenSpec、schema、示例和测试按实际语义选择类型。
relations:
  - type: 拆分
    target: git-commit-organizer/260702-refine-commit-granularity-types-and-command.md
---

## 目的
- 让模型、工具、连接、权限和运行参数等 AI 配置变化在提交历史中可以独立检索。
- 防止项目计划、行为契约和验证资产仅因由 AI 使用就失去真实类型语义。

## 背景
- AI 或 agent 运行配置与一般仓库维护具有不同的追踪价值，全部归入通用维护类型会隐藏运行环境变化。
- Skill 说明、agent 协作规则、OpenSpec、schema、示例和测试策略可能直接承接计划、产品契约或验证义务，并不等同于运行配置。
- 提交粒度、消息格式和当前任务改动范围不由类型名称决定。

## 决策
- 采用: 只有提交纯粹调整 AI 或 agent 配置时使用 `ai`，包括模型、工具、MCP 或 app 连接、权限、运行参数和配置化 prompt。
- 采用: Skill 说明、agent 协作规则、OpenSpec、schema、示例和测试策略不因服务 AI 而自动使用 `ai`，应按实际影响选择 `plan`、`spec`、`docs`、`test` 或其他适用类型。
- 采用: 同一语义单元同时改变运行配置和其他契约时，先按语义依赖判断是否拆分；不能拆分时选择历史中最需要追踪的主要影响，不让 `ai` 覆盖全部 AI 相关内容。
