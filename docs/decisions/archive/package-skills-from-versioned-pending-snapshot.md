---
title: 从版本管理 pending 快照打包 skill
status: archived
alignment: aligned
createdAt: 2026-08-11T04:14:58Z
purpose: 让 skill hash 与 ZIP 只反映准备进入下一版本的稳定分发输入，而不混入工作区临时内容或打包期生成。
background: 工作区可能包含未选择改动；打包时临时构建又会让制品来源不同于已审阅的待提交内容。
decision: Hash 与 pack 共用版本管理 pending 中的 skill 文件快照，pack 不生成或修复输入，只收集已经存在的稳定内容。
tags:
  - project-tooling
relations: []
---

## 目的

- 让版本校验、skill hash、ZIP 和 release manifest 使用同一组准备进入下一版本的文件。
- 阻止工作区未选择内容或打包期间产生的新文件静默进入制品。

## 背景

- Git 工作区可以同时包含尚未准备交付的修改；直接按文件系统打包会让制品范围偏离待提交版本。
- 可分发工具产物由显式 `sync:*` 生成并由 `check:*` 核对，打包阶段再生成会建立另一条不可审阅的输入路径。
- 每个 skill 独立版本化，打包输入只需要覆盖最终进入对应 skill 制品的路径。

## 决策

- 采用: `hash:skills` 与 `pack:skills` 通过版本管理中间层读取同一 `pending` 快照，只消费 `skills/<skill-name>/` 下准备进入下一版本的文件。
- 采用: 工作区存在但未进入 `pending` 的内容不进入 hash、ZIP 或 release manifest；跨平台工作区换行也不改写已选择快照的字节。
- 采用: `pack:skills` 不在打包期间运行 `sync:*`、构建或修复生成产物；需要进入制品的生成文件必须提前写入并进入 `pending`。
- 采用: 每个 skill 分别生成 ZIP，聚合 manifest 只记录独立版本；项目文档、`tools/`、`scripts/`、CI 和仓库元数据不直接进入制品。
- 采用: 打包前置门禁、ZIP 字节确定性和生成产物构建分别由各自 owner 维护；本记录只拥有制品输入快照。
- 不采用: 直接遍历工作区构造正式制品，或用打包期临时生成掩盖 stale、缺失或未选择的分发输入。
