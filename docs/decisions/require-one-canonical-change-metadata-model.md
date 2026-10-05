---
title: 以唯一规范模型解析 Change Metadata
id: 261004-require-one-canonical-change-metadata-model
status: active
alignment: aligned
createdAt: 2026-10-04T15:28:51Z
purpose: 让当前 Change 的磁盘 metadata、运行时类型与查询 stage 来自同一严格解析事实。
background: 隐式状态投影会扩大读取、写入、类型与验证的维护面，并使同一计划在不同入口产生不同解释。
decision: 仅接受规范 draft 与具有非空无空白 baseCommit 的 plan；无效输入显式修复，不做状态投影或自动迁移。
tags:
  - change-plan
  - metadata-design
  - validation-boundaries
relations:
  - type: 修订
    target: require-canonical-active-change-metadata
    summary: 保留严格单一 metadata 模型，限定为当前计划契约
---

## 目的

- 让 `skills/change-plan/` 的当前计划 metadata 只有一套可直接恢复的规范事实，不因读取、查询或写入入口不同而改变含义。
- 让内容成熟度、任务进度与结项证据保持分工，不通过 metadata 隐式制造额外生命周期。

## 背景

- Draft 与 Plan 表达当前计划的内容成熟度，readiness、implementation 和 verification 的实际进度由 `tasks.md` 表达。
- 把未定义状态或非法字段组合投影为正常 Plan，会要求解析、查询、写入、类型和测试长期维护第二套输入模型，且不能带来独立产品语义。
- `baseCommit` 是 Plan 的 Git 距离起点，不是 artifact 内容快照或结项授权；其解释与距离计算由现有 Git 距离方向及 Change Plan 契约承接。

## 决策

- 采用: 当前 Change metadata 只接受 `{ "stage": "draft" }` 或 `{ "stage": "plan", "baseCommit": "<revision>" }`；`baseCommit` 须为非空且不含空白的字符串，对象只含对应字段。磁盘事实、运行时类型与查询 stage 使用同一严格解析模型。
- 未定义状态、缺失基线或非法字段组合须按普通文件与版本控制流程显式修复，再进入正常维护；正常命令不投影、自动迁移或补造合法状态。
- 无效成员仍可被发现和定位，但没有合法 stage 且检查失败。任务进度和结项事实由各自 owner 表达，不扩充持久 stage。
- 严格字段结构与工具行为由 Change Plan 固定契约拥有；Git 距离计算与结项删除门禁分别沿用对应契约。
