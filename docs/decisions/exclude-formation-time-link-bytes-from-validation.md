---
title: 排除形成时链接字节的持续校验
status: active
alignment: aligned
createdAt: 2026-08-15T04:14:19Z
purpose: 让当前链接门禁覆盖可维护文档，同时保留历史形成时材料各自的 owner 边界。
background: 归档 Change 与调查资源都保存形成时字节，持续链接校验会把后续 owner 变化错误转化为维护义务。
decision: bun run validate 排除归档 Change 与调查资源；Change Plan 只在归档前门禁，Investigation Report 维护资源完整性。
tags:
  - project-tooling
relations:
  - type: 修订
    target: exclude-archived-changes-from-link-validation.md
---

## 目的

- 让链接校验持续证明当前维护 Markdown 的可用性，不改写形成时材料。

## 背景

- 归档 Change 是通过归档前门禁的历史回放；归档后 Change Plan 只负责发现和原始读取，不再校验其结构。
- Investigation `_resources` 保存调查形成时字节，由 Investigation Report 的资源引用与完整性门禁维护。

## 决策

- 采用: `bun run validate` 排除 `changes/archive/**` 和 `docs/investigations/_resources/**`。
- 采用: active Change、当前 investigation topic 与其他可维护 Markdown 继续参与链接校验。
- 采用: Change Plan 的 archive 在移动前门禁 active Change；移动后的历史目录不再进入 Change Plan checker。
- 采用: Investigation `_resources` 继续进入资源引用与完整性门禁；不以主仓库链接检查替代。
