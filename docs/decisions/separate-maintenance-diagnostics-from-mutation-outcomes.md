---
title: 将维护诊断与 mutation 结果分层
status: active
alignment: aligned
createdAt: 2026-09-02T04:18:29Z
purpose: 让跨工具维护失败可立即定位并保留各领域可证明的恢复范围，而不混淆共享原因与领域提交结果。
background: 共享版本控制与索引运行时服务多个维护工具；若共享层替领域猜测事务结果，或领域持久化临时诊断，恢复边界会失真且责任扩散。
decision: 共享层只提供经净化的操作原因，Index Runtime 只拥有 pending 范围，领域工具各自拥有 mutation 结果并即时渲染；禁止持久诊断、自动提权、删锁与重试。
tags:
  - decision-records
  - index-runtime
  - investigation-report
  - version-control
relations: []
---

## 目的

- 让维护 CLI 的失败与 warning 在当前命令中给出足够的定位和恢复动作，而不把临时诊断变成集合事实。
- 让共享版本控制、派生索引运行时和领域事务各自只声明能够证明的原因、范围与结果。

## 背景

- 共享版本控制服务多个工具，能够可靠提供操作事件、原因类别、对象和经净化的 detail，但不知道领域 mutation 的完整提交范围。
- Index Runtime 能保护并替换一个索引的 pending 路径，却不拥有领域 Markdown、资源或生命周期事务的提交点。
- Decision Records 与 Investigation Report 都有多文件 mutation，需要区分未改变、已完整恢复、恢复状态未知和已提交但 cleanup 未完成，才能避免不安全重放。
- 错误、warning、锁和权限的即时操作提示应帮助本次操作者恢复，而不是形成日志、遥测、receipt 或新的持久业务状态。

## 决策

- 采用: 共享版本控制错误稳定表达操作事件、可靠原因、对象和经过净化的 detail；共享层不表达领域 mutation 的 `scope` 或 `outcome`。
- 采用: Index Runtime 只为自己可证明的 pending 路径表达范围与结果；领域工具不得把该局部事实扩写为完整集合 mutation 结果。
- 采用: Decision Records 与 Investigation Report 由各自事务 owner 为 mutation 失败声明范围，并只使用 `no-change`、`rolled-back`、`partial-or-unknown` 与 `committed-cleanup-pending` 四种结果；普通读取、校验和参数失败不附会 mutation 字段。
- 采用: CLI 在 stdout 保留成功信息，在 stderr 即时输出失败和 warning；诊断不持久化为日志、遥测或 receipt。操作者处理原因后才显式重试，工具不建议 `sudo`、不自动删除锁，也不自动重试。
