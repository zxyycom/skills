---
title: 从版本管理 pending 快照读取 skill 制品输入
status: active
alignment: aligned
createdAt: 2026-08-11T04:19:41Z
purpose: 让 skill hash 与打包读取同一组准备进入下一版本的稳定文件，而不混入工作区临时内容或打包期生成。
background: 工作区可能包含未选择改动；打包时临时构建又会让制品输入不同于已审阅的待提交内容。
decision: Hash 与 pack 共用版本管理 pending 中的 skill 文件快照；pack 不生成或修复输入，只消费已经存在的稳定内容。
relations:
  - type: 修订
    target: project-tooling/package-skills-from-versioned-pending-snapshot.md
---

## 目的

- 让版本校验、skill hash 与 ZIP 读取同一组准备进入下一版本的文件。
- 阻止工作区未选择内容或打包期间产生的新文件静默进入制品输入。

## 背景

- Git 工作区可以同时包含尚未准备交付的修改；直接按文件系统读取会让输入偏离待提交版本。
- 可分发工具产物由显式 `sync:*` 生成并由 `check:*` 核对，打包阶段再生成会建立另一条不可审阅的输入路径。
- 独立 ZIP、聚合 release、版本 manifest 与根目录内容的分发边界由 [Repository Model](../repository-model/use-monorepo-versioned-skill-packages.md) 拥有，不属于输入快照责任。

## 决策

- 采用: `hash:skills` 与 `pack:skills` 通过版本管理中间层读取同一 `pending` 快照，只消费 `skills/<skill-name>/` 下准备进入下一版本的文件。
- 采用: 工作区存在但未进入 `pending` 的内容不进入 hash 或 ZIP；跨平台工作区换行也不改写已选择快照的字节。
- 采用: `pack:skills` 不在打包期间运行 `sync:*`、构建或修复生成产物；需要进入制品的生成文件必须提前写入并进入 `pending`。
- 采用: 打包前置门禁、输出制品结构、ZIP 字节确定性和生成产物构建分别由各自 owner 维护；本记录只拥有制品输入快照。
- 不采用: 直接遍历工作区构造正式制品，或用打包期临时生成掩盖 stale、缺失或未选择的分发输入。
