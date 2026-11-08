---
title: 以纯数据共享记录索引机器契约
id: 261108-share-record-index-json-contracts
status: active
alignment: aligned
createdAt: 2026-11-08T12:05:31Z
purpose: 让两域与多语言运行时共享可分发的索引机器结构。
background: 旧 Schema 构造位于领域 TypeScript 源码，妨碍原生实现独立交付。
decision: 两域索引 JSON Schema 以独立纯数据源维护，领域语义与集合校验仍归各域。
tags:
  - artifact-integrity
  - decision-records
  - investigation-report
relations:
  - type: 修订
    target: package-current-index-json-schema
---

## 目的

- 让编辑器、恢复工具与两种语言的维护实现共享可分发机器结构，而不要求依赖旧领域 SDK。

## 背景

- 旧决策要求从 Decision Records 的 TypeScript 常量构造 Schema；原生交付需要独立于该运行时的格式数据。
- JSON Schema 不能表达全部身份、关系、来源和领域语义，运行时仍需独立校验，机器结构不能替代领域规则。

## 决策
- 采用: Decision Records 与 Investigation Report 的随包索引 JSON Schema 由 `tools/record-contracts/schemas/` 内纯 JSON 数据维护，生成器复制该源；迁移期的旧导出使用同一份数据。
- 采用: 两域各自的记录格式、业务语义与集合级验证继续由领域 owner 承接；Schema 只描述机器结构和基础约束，不能代替 CLI 检查。每次更改格式时对照两种运行时和领域规则核验，避免将现有实现差异当作缩窄格式的依据。
- 采用: 继续随对应 skill 分发当前 Schema，并以生成检查防止副本漂移；当前版本属于格式事实，不固定在长期判断中。
