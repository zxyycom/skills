---
title: 采用日期前缀记录身份
id: 260904-adopt-date-prefixed-record-identities
status: active
alignment: aligned
createdAt: 2026-09-04T15:51:50Z
purpose: 让保留记录在语义同名时仍可稳定选择并保留形成日。
background: 纯 ID 与 sourcePath 分离后，长期 Decision 和 Investigation 仍需要可解释的重名身份与无猜测 selector。
decision: "采用: 使用 UTC 日期前缀标准 ID、ID-first/name-fallback 解析和显式 legacy 迁移。"
tags:
  - artifact-identity
  - decision-records
  - investigation-report
relations: []
---

## 目的

让具有同一语义名称但形成于不同时间的长期记录保持可解释、可精确选择的身份，同时不把文件路径当作身份。

## 背景

Decision 与 Investigation 已把 frontmatter ID 和 sourcePath 分离，但旧纯 ID 无法区分后续同名形成事件。调用方需要唯一 name 时的简写，也必须在重名时得到稳定、无猜测的完整 ID。

## 决策

- 采用: 新 Decision 和 Investigation 都使用 UTC 形成日加语义 name 组成 calendar-valid `YYMMDD-<name>` 标准 ID。
- 采用: 普通 selector 先移除一个末尾 `.md` 并精确解析标准 ID；只有解析失败时才按 name 索引回退，重名明确报 ambiguous。
- 采用: 保留无日期 legacy ID 的读取能力；新建会造成 legacy 同名冲突时，先返回 migration-required，由显式 rename 完成历史迁移后重试。
