---
title: Agent Memory 以项目 SQLite 为唯一事实源
id: 261118-agent-memory-sqlite-fact-source
status: active
alignment: aligned
createdAt: 2026-11-18T03:48:32Z
purpose: 让项目记忆及其版本与依赖在修订时原子一致并可控回访。
background: 跨版本依赖和即时失效需要一致事务，Markdown 与派生索引难以共同保证。
decision: 仅 agent-memory 使用项目 SQLite 保存权威内容与关系，Markdown 作为正文格式和只读展示。
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
- Markdown 是正文格式和只读展示，不作为可独立编辑或重建数据库的权威副本。现行读取共同校验依赖有效性，历史版本供明确回放。
- 此例外不改变 Decision、Investigation 等其他领域的 Markdown 事实源、身份或索引规则，也不建立跨项目或全局记忆库。
