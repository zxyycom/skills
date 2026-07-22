---
status: active
alignment: aligned
createdAt: 2026-07-22T09:44:48Z
---

# 随包分发当前索引 JSON Schema

## 索引摘要
- 目的: 让编辑器和恢复工具直接取得机器可读的当前索引结构，并让分发产物与 CLI 保持一致。
- 背景: 当前格式版本会演进，长期决策若固定具体版本会把实现事实误写成稳定方向。
- 决策: 从 CLI 共享常量生成当前索引 JSON Schema，随 decision-records 分发并用生成检查防止漂移。

## 目的
- 让编辑器、JSON Schema 工具和临时恢复工具可以直接读取当前索引的字段、类型、枚举和基础格式。
- 让 release zip、源码目录和已安装 skill 都携带与 CLI 一致的索引结构资源。
- 让 JSON Schema 与 CLI 共用路径、时间、状态、关系类型和投影长度常量，并由生成检查防止产物漂移。

## 背景
- 固定契约足以解释当前格式，但临时工具仍需要机器可读的字段、嵌套结构、枚举和基础约束。
- 索引 schema 的具体版本属于当前格式 owner，会随格式演进；随包分发当前 Schema 的长期方向不依赖某个版本号。
- JSON Schema 适合承接单文件结构校验；路径唯一性、排序、Markdown 投影一致性和关系图属于集合级检查。

## 决策
- 采用: 在 decision-records 源码中维护 JSON Schema 生成对象，并复用当前 CLI 的路径、时间、状态、关系类型和投影长度常量。
- 采用: 构建入口将当前 Schema 确定性写入 `skills/decision-records/references/decision-index.schema.json`，生成检查和测试验证分发文件与源码一致。
- 采用: skill 入口和恢复手册将该文件作为编辑器、临时 CLI 和手工索引恢复的机器可读资源。
- 采用: JSON Schema 承接字段、类型、枚举、路径和基础格式；集合级语义继续由固定契约和 CLI `check` 承接。
- 采用: 长期决策不固定具体 schema 版本；当前版本只由固定契约、Schema 文件和 CLI 实现表达。

## 关系
- 修订: [随包分发索引 JSON Schema](package-index-json-schema.md)
