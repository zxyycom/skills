---
title: 只通过当前工具维护派生索引
status: active
alignment: aligned
createdAt: 2026-07-23T05:48:17Z
purpose: 让索引故障恢复保持一条低成本、可执行且可验证的正式路径。
background: 手工构造通用索引没有日常产品价值，还会复制 state、keys 与 revision 协议。
decision: 工具恢复前停止索引写入；恢复当前 CLI 后只由它从权威 Markdown 重建并校验索引。
relations:
  - type: 替代
    target: decision-records/recover-current-format-tools-and-index.md
---

## 目的
- 让索引故障恢复保持一条低成本、可执行且可验证的正式路径。
- 避免为了低频故障维护第二套索引实现、校验逻辑和隐含兼容边界。

## 背景
- 手工构造通用索引没有日常产品价值，还会复制 state、keys 与 revision 协议。
- 通用索引同时保存领域完整 state、派生查询 keys 和源 revision；只通过 JSON Schema 无法证明它们来自同一批权威 Markdown。
- 当前 CLI、兼容运行时、随包更新器、release 和源码已经提供恢复正式实现的多条入口。

## 决策
- 采用: 当前 CLI 无法执行时，只读审阅 Markdown、索引和 Git 中最后可信版本，不直接构造、修补或替换索引。
- 采用: 工具恢复前不运行会改变生命周期、对齐状态、关系或索引的维护事务；任务必须写入时报告阻断并请求新的处理条件。
- 采用: 通过兼容运行时、随包更新器、当前 release 或仓库源码恢复当前 CLI，不维护临时复刻或第二套长期实现。
- 采用: CLI 恢复后只从权威 Markdown 运行 `sync-index --write` 重建索引，并以严格 `check` 通过作为完成条件。
- 采用: 索引 reader 从同一批源文本产生 state 与 revision，通用同步在写入前再次核对 revision；任何一次核对失败都保留原索引。
