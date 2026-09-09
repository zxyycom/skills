---
title: 采用 Vibe Check 0.0.2 的原生门禁边界
id: 260909-adopt-vibe-check-0-0-2-gate-runtime
status: archived
alignment: aligned
createdAt: 2026-09-09T06:13:34Z
purpose: 让项目门禁直接采用新版宿主、分析器与安全检查契约。
background: 0.0.2 已替代旧扫描兼容层并改变运行时、诊断和依赖结算语义。
decision: 升级到 0.0.2，由 Node 承载门禁并只保留 SCC 外部前置。
tags:
  - project-tooling
relations: []
---

## 目的

- 让项目门禁直接使用 Vibe Check 0.0.2 提供的安全、重复与函数分析能力。
- 让本地、CI 与恢复指引共享同一套可验证的宿主和外部工具边界。

## 背景

- Vibe Check 0.0.2 将 function metrics 分析器包含在包内，duplicate detection 直接处理项目相对路径，并新增 secret detection；项目不再需要 Lizard 或 jscpd 路径适配器。
- 新版宿主契约要求 Node.js 24.18 或更高版本，file metrics 的外部运行时为 SCC 4.0.0。
- 诊断日志已按 core 与 scheduler 通道分开；直接依赖未通过时，依赖项以 unavailable 结算，调用方必须保留这些原生语义而不再维护兼容层。

## 决策

- 采用: 项目门禁固定使用 `@zxyycom/vibe-check` 0.0.2，由 Node.js 24.18 或更高版本执行；CI 与环境预检同步验证该下限。
- 采用: duplicate detection 和 function metrics 直接使用包内分析器，删除项目的 jscpd 与 Lizard 适配层；file metrics 仅保留 SCC 4.0.0 作为外部前置。
- 采用: 将 secret detection 纳入 base 门禁并对显式列出的可维护文本文件执行；命中即阻断 aggregate，不扫描依赖目录、构建产物或任意二进制文件。
- 采用: CLI 分别报告 core 与 scheduler 诊断日志，并接受 0.0.2 的原生依赖结算语义；不为旧日志键或依赖失败表达保留翻译层。
