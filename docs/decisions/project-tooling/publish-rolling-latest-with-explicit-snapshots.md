---
title: 滚动发布 latest 并显式创建不可变快照
status: active
alignment: aligned
createdAt: 2026-08-14T09:20:04Z
purpose: 控制发布资产持续增长，同时保留正式当前版本和按需回滚入口。
background: 旧发布路径为每次 skill 内容变化保存完整版本化 Release、滚动 Release 和 CI artifact，产生重复资产与高频 tag。
decision: 以 skills-latest 承接正式滚动发布，只在手动显式请求时按聚合 hash 创建不可变快照，并短期保留 CI artifact。
relations:
  - type: 修订
    target: project-tooling/260701-publish-versioned-skill-releases.md
---

## 目的
- 控制 GitHub tag、Release 和重复资产的持续增长，同时保留经过 CI 验证的正式当前制品和必要的历史复现入口。

## 背景
- 旧发布路径为每次 skill 分发内容变化保存一份完整版本化 Release，再覆盖一份 `skills-latest`，同一 workflow 还长期保留完整 artifact；聚合发布因此持续产生重复资产。
- updater 默认读取 GitHub Latest release，并允许通过 `--release-tag` 定位历史 Release；当前发布入口必须继续满足默认更新，同时历史快照不需要与每次 `main` push 一一对应。
- 人工语义版本仍不适合聚合仓库；聚合 package hash 已能稳定标识相同的完整制品内容。

## 决策
- 采用: `main` 上实际改变 skill 分发内容的 push 更新 `skills-latest` 的 tag 和完整资产集，并把该滚动 Release 标记为 GitHub Latest。
- 采用: 不可变聚合快照只在 `workflow_dispatch` 显式选择时创建，tag 使用 `skills-<hash12>`；同名快照已存在时核对完整资产集合的名称、字节数和 SHA-256 digest，一致则复用，不一致则停止且不改写快照。
- 采用: CI workflow artifact 只作为 job 交接和短期 PR 核对材料保留 7 天，不承担正式分发或长期回滚责任。
- 采用: updater 的默认 latest 读取继续获得正式滚动制品；`--release-tag` 只保证可读取仍被保留的不可变快照或历史 Release，不承诺每次分发内容变化都永久保留独立 Release。
- 不采用: 继续为每次 skill 内容变化创建带时间戳的永久 Release；发布时间展示价值不足以抵消重复 tag、资产和清理成本。
