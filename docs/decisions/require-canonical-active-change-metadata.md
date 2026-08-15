---
title: 仅接受规范的 Active Change Metadata
status: active
alignment: aligned
createdAt: 2026-08-14T02:39:17Z
purpose: 让 Active Change 的磁盘 metadata、运行时类型和查询 stage 只有同一套 Draft 与 Plan 事实。
background: 旧状态投影只节省少量一次性迁移，却长期增加隐藏语义、特殊不变量和跨命令测试成本。
decision: Active Change 只接受规范 Draft 与非空基线 Plan；旧状态和 null-base Plan 直接判为无效，当前数据显式迁移且 archived 历史继续不解析。
tags:
  - change-plan
relations:
  - type: 修订
    target: simplify-change-lifecycle-to-draft-plan-and-archive.md
---

## 目的

- 让 `skills/change-plan/` 使用唯一、严格且可直接恢复的 active metadata 契约。
- 让 Draft、Plan 与 archived 的长期方向不再依赖隐藏的旧状态投影或无退出时间的兼容层。

## 背景

- Draft 与 Plan 是 Active Change 唯一需要持久表达的内容成熟度；任务进度由 tasks 表达，完成结果由 archived 目录表达。
- 旧 implementation、shelved 与 null-base Plan 的读取投影不会保留仍有效的独立产品语义，却要求 checker、查询、写入、类型、文档和测试长期维护第二套输入模型。
- 作出本决策时，仓库只有少量旧 active metadata，可以显式迁移并保留原 Git 基线；archived 历史本来就不读取 metadata。一次性迁移成本低于永久兼容成本。

## 决策

- 采用: Active Change 的 metadata 只接受严格的 `{ "stage": "draft" }`，或具有非空无空白 `baseCommit` 的 `{ "stage": "plan" }`；stage、metadata 与查询结果来自同一规范解析事实。
- 采用: implementation、shelved、旧 shelf、`baseCommit: null` 及其他未定义字段直接产生无效 metadata 诊断，不投影为 Plan，不由 `plan` 自动恢复，也不增加迁移命令、兼容开关或弃用期。
- 采用: 已知旧 active metadata 通过一次性显式改写进入规范 Plan，保留既有基线且不借迁移声明语义复核、任务完成或归档授权；仓库外旧输入由其维护者显式修复。
- 采用: Active 生命周期继续为 `draft -> plan -> archived`，Readiness、Implementation 与 Verification 全部在 Plan 内推进，CLI 继续只提供发现、检查、Plan 确认与归档所需的六个命令。
- 采用: Archived Change 的 metadata 继续只作为历史文件保存，checker 不读取、解释或迁移它。
