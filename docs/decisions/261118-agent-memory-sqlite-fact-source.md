---
title: Agent Memory 以项目 SQLite 为唯一事实源
id: 261118-agent-memory-sqlite-fact-source
status: active
alignment: aligned
createdAt: 2026-11-18T03:48:32Z
purpose: 让项目记忆及其版本与依赖在修订时原子一致并可控回访。
background: 跨版本依赖和即时失效需要一致事务，Markdown 与派生索引难以共同保证。
decision: agent-memory 以项目 SQLite 原子维护记忆内容、版本与关系，正文可包含 Markdown。
tags:
  - agent-memory
  - repository-model
relations: []
---

## 目的

- 让项目记忆的内容、版本和依赖在修订与复核时保持一致，并能及时阻止过时结论被采用。

## 背景

- 适用 skill 为 `agent-memory`，路径为 `skills/agent-memory/`。记忆可能由多个确切版本共同构成；前提改变后，直接和间接依赖必须在读取时立即受阻。
- Markdown 与派生索引分开维护难以在同一事务内更新内容、版本与关系；现有受管记录的身份与位置分离仍有价值。

## 决策

- 采用: 仅对 agent-memory 项目记忆，以绑定项目的 SQLite 库作为内容、版本、标签、状态及关系的唯一事实源，由 CLI 在事务中维护；稳定单元 ID 与数据库位置分离。
- 正文可包含 Markdown；它与版本及依赖一同存储。现行读取校验依赖的有效性，指定历史版本可回放原文，但不能据此采用已失效的结论。
- 此例外不改变 Decision、Investigation 等其他领域的 Markdown 事实源、身份或索引规则，也不建立跨项目或全局记忆库。
