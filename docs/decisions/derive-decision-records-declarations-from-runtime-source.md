---
title: 从 Decision Records 源码派生声明
status: active
alignment: aligned
createdAt: 2026-08-15T06:11:01Z
purpose: 让 CLI 与程序化调用共享一个实现和公共导出事实源，避免独立手写声明漂移。
background: Decision Records 的 CLI 模块已公开程序化调用所需的值和类型导出；手写声明会复制接口责任。
decision: 程序化调用直接使用 CLI 模块的公共导出，并由 TypeScript 从实现机械生成声明入口及可达声明闭包。
tags:
  - decision-records
relations: []
---

## 目的

- 让命令行与程序化调用持续使用同一套 Decision Records 实现和公开导出。
- 消除手工同步运行时导出与声明文件的维护责任。
- 让独立 skill 分发的声明可解析，同时不把内部实现变成公开接口。

## 背景

- `tools/decision-records/src/cli.ts` 已经导出 CLI 所调用的核心能力及程序化调用需要的类型；程序化调用只是该模块的导入面，而不是独立 SDK。
- 手写 `tools/decision-records/api/decision-records.d.mts` 会复制接口责任；公共导出变化时无法由实现机械保证声明同步。
- TypeScript 可以从实现发出声明；分发只应保留从 CLI 声明入口可达的声明闭包，避免暴露内部模块或要求消费者安装内部依赖。

## 决策

- 采用: `tools/decision-records/src/cli.ts` 的公共运行时导出和明确 `export type` 的类型导出共同构成命令行与程序化调用的接口事实源；不另设 SDK 实现或人工维护的类型清单。
- 采用: 构建器使用 TypeScript 从实现机械生成声明入口及其可达声明闭包。声明入口公开 CLI 的公共值和类型导出，并只携带其签名所需的可达声明；它不暴露仅供内部维护或测试注入的实现细节。
- 采用: 与分发 MJS 配对的声明入口及其闭包属于生成产物，由 `sync:decision-records-cli` 写入、`check:decision-records-cli` 重建核对。
- 不采用: 手写 `tools/decision-records/api/decision-records.d.mts`、脱离 CLI 公共导出的便捷接口，或为该小型工具另建 SDK registry 与第二套接口版本管理。
