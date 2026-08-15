---
title: 从 task-graph 运行时源码派生 SDK 声明
status: active
alignment: aligned
createdAt: 2026-08-07T04:59:10Z
purpose: 让 CLI 与程序化调用共享一个实现和公开导出事实源，避免人工声明漂移。
background: Task-graph 模块已经安全导出 CLI 所调用的核心能力；把 SDK 作为独立接口层会重复维护同一接口，并可能泄漏内部依赖。
decision: 程序化调用直接使用 CLI 模块的公开导出，由 TypeScript 实现机械生成声明入口及其可达声明树，不维护独立 SDK 实现、接口清单或声明源。
tags:
  - task-graph
relations: []
---

## 目的

- 让命令行调度与程序化调用始终使用同一套任务图实现和公开导出。
- 删除人工同步实现、运行时导出和声明文件的维护责任。
- 让独立 skill 中的 SDK 声明保持可解析，同时不暴露存储、锁和 runtime 等内部模块。

## 背景

- `task-graph.mjs` 已经可以无副作用导入；程序化调用直接使用其公开导出，CLI dispatch 只是同一模块外层的参数解析与 JSON envelope。
- 另设 SDK 实现或手工维护 `api/task-graph.d.mts` 都会复制接口责任；新增、删除或调整接口时需要另一处同步，实际代码无法机械保证两者一致。
- TypeScript 编译器可以从实现发出声明，但完整编译图还包含未被公开入口引用的内部模块，因此分发只应保留从公开入口可达的声明闭包。
- 同名根声明必须继续与单文件 ESM 配对；闭包中的拆分声明可以留在 skill 包内，由根声明统一引用。

## 决策

- 采用: `tools/task-graph/src/cli.ts` 的公开导出是命令行与程序化调用的共同接口事实源；SDK 只是该模块的程序化导入面，不另设实现、接口清单或类型契约。
- 采用: 构建器使用 TypeScript 编译器从实现发出声明、移除标记为 internal 的成员，并只分发从 `cli` 声明入口可达的声明闭包。
- 采用: `scripts/task-graph.d.mts` 作为与 `task-graph.mjs` 配对的公开声明入口，包内声明树承接拆分模块；两者都属于生成产物并由 `sync:*` 与 `check:*` 维护。
- 采用: SDK 公开面只能来自实际运行时导出；存储、锁、runtime 探测和仅供测试注入的类型不进入根入口，生成声明也不能要求消费者安装实现内部依赖。
- 不采用: 独立手写 `api/task-graph.d.mts`、仅声明但没有运行时导出的便捷工厂，以及为小型工具另建 SDK registry 或第二套接口版本管理。
