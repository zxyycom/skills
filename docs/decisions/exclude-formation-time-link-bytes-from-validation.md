---
title: 排除形成时链接字节的持续校验
status: active
alignment: aligned
createdAt: 2026-08-15T04:14:19Z
purpose: 让当前链接门禁覆盖可维护文档，同时保留历史形成时材料的专属验证责任。
background: 归档 Change 与调查资源都保存形成时字节，持续链接校验会把后续 owner 变化错误转化为维护义务。
decision: bun run validate 排除归档 Change 和调查资源 Markdown，分别由 Change Plan 与 Investigation Report 门禁维护。
tags:
  - project-tooling
relations:
  - type: 修订
    target: exclude-archived-changes-from-link-validation.md
---

## 目的

- 让链接校验持续证明当前维护 Markdown 的可用性，不改写形成时材料。

## 背景

- 归档 Change 是已完成计划的历史回放，由 Change Plan 维护其结构与归档门禁。
- Investigation `_resources` 保存调查形成时字节，由 Investigation Report 的资源引用与完整性门禁维护。

## 决策

- 采用: `bun run validate` 排除 `changes/archive/**` 和 `docs/investigations/_resources/**`。
- 采用: active Change、当前 investigation topic 与其他可维护 Markdown 继续参与链接校验。
- 采用: 两类排除范围分别保留在其既有 owner 的专属门禁中，不以链接检查替代。
