---
status: archived
alignment: null
createdAt: 2026-07-21T01:29:45Z
---

# 随包分发索引 JSON Schema

## 索引摘要
- 目的: 让工具损坏时可以直接取得机器可读的索引结构并恢复必要操作。
- 背景: 固定契约足以解释格式，但临时工具仍需要重新提取字段、枚举和基础约束。
- 决策: 从 CLI 共享常量生成索引 JSON Schema，并作为 decision-records 资源随包分发。

## 目的
- 让编辑器、JSON Schema 工具和临时恢复工具可以直接读取 schema v3 的字段、类型、枚举和基础格式。
- 让 release zip、源码目录和已安装 skill 都携带同一份索引结构资源。
- 让 JSON Schema 与 CLI 共用路径、时间、状态、关系类型和投影长度常量，并由生成检查防止产物漂移。

## 背景
- CLI 故障恢复已经支持重新下载分发包、从源码重建或复现当前需要的最小命令。
- 只有说明文档和 TypeScript 声明时，临时实现仍需要自行整理索引的嵌套结构和枚举。
- JSON Schema 适合承接单文件结构校验；路径唯一性、排序、Markdown 投影一致性和关系图属于集合级检查。

## 决策
- 采用: 在 decision-records 源码中维护 JSON Schema 生成对象，并复用现有路径、时间、状态、关系类型和投影长度常量。
- 采用: 构建入口将其确定性写入 `skills/decision-records/references/decision-index.schema.json`，生成检查和测试验证分发文件与源码一致。
- 采用: skill 入口和恢复手册将该文件作为编辑器、临时 CLI 和手工索引恢复的机器可读资源。
- 采用: JSON Schema 承接字段、类型、枚举、路径和基础格式；集合级语义继续由固定契约和 CLI `check` 承接。
