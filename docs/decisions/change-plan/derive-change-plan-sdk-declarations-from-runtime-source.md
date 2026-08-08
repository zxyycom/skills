---
title: 从 Change Plan 运行时源码派生 SDK 声明
status: active
alignment: aligned
createdAt: 2026-08-08T04:18:46Z
purpose: 让 Change Plan 的运行时 API、分发声明和 metadata 机器契约保持同一事实源。
background: CLI 公开导出和 Valibot metadata schema 已经定义真实运行时边界，独立手写声明会重复维护接口并产生漂移。
decision: 从运行时公开导出派生可达 SDK 声明树，从 metadata schema 派生 JSON Schema 和公开类型，不维护独立 api 声明源。
relations: []
---

## 目的

- 让 `skills/change-plan/` 分发的运行时 API、TypeScript 声明和 metadata 机器契约始终对应真实实现。
- 删除实现、公开导出、metadata schema 与独立声明之间的人工同步责任。

## 背景

- `tools/change-plan/src/cli.ts` 已经集中公开命令行与程序化调用共同使用的运行时能力。
- `tools/change-plan/src/metadata.ts` 的 Valibot schema 已经负责运行时收窄和领域类型，能够继续派生跨工具使用的 JSON Schema 与公开 TypeScript 类型。
- 另行维护 `tools/change-plan/api/` 声明会复制同一接口；实现或 schema 变化时，手工清单无法机械保证同步。
- 完整 TypeScript 编译图包含内部模块，分发声明只应保留从公开入口可达的闭包。

## 决策

- 采用: 本决策只适用于 `skills/change-plan/`；`tools/change-plan/src/cli.ts` 的公开导出是运行时 API 与程序化调用的共同事实源，由构建器机械生成声明入口及其可达 SDK 声明树。
- 采用: Valibot metadata schema 是 `.change-plan.json` 运行时校验、JSON Schema 和公开 metadata 类型的共同事实源；生成声明不能要求消费者安装实现内部依赖。
- 采用: 分发声明和 schema 都是生成产物，由 Change Plan 的 `sync:*` 与 `check:*` 入口维护。
- 不采用: 独立 `tools/change-plan/api` 声明源、手写公开接口清单或与运行时导出分离的第二套 SDK 契约。
