---
title: 以 definitionVersion 标识索引定义兼容性
status: active
alignment: aligned
createdAt: 2026-08-11T04:02:53Z
purpose: 让持久索引明确区分定义契约变化与普通来源变化，并在投影不兼容时安全重建。
background: Source revision 只能证明来源新鲜度，不能判断 parser、metadata、ID 或 key 投影契约是否仍兼容。
decision: 领域以 definitionVersion 标识完整投影契约；兼容性变化提升版本，失配时拒绝并从权威源重建。
tags:
  - index-runtime
relations:
  - type: 拆分
    target: use-independent-read-side-index-runtime.md
---

## 目的

- 让持久索引记录生成它的领域定义兼容身份，避免当前运行时静默解释旧契约产生的投影。
- 让定义兼容、来源新鲜度和通用存储格式分别拥有明确版本责任。

## 背景

- 相同来源内容在 parser 输出、metadata 契约、ID 上下文或 key 投影规则变化后，可能产生不同 state 或查询结果。
- Source revision 跟踪某个既定 definition 下的来源变化；它不表达 definition 本身的兼容性。
- 普通内容更新和不改变投影的内部重构不应触发定义版本升级，也不需要迁移旧投影。

## 决策

- 采用: 每个领域定义提供 `definitionVersion`，并与 definition identity 一起写入持久索引；运行时只按当前领域定义解释版本完全匹配的投影。
- 采用: Parser 输出或校验契约、metadata 契约、持久 state 形状、ID 上下文规则，或 key 的名称、模式、来源与含义发生会改变持久投影或查询解释的变化时提升 `definitionVersion`。
- 采用: 普通来源成员或内容变化只更新 source revision；不改变持久投影与查询解释的实现重构不提升 `definitionVersion`。
- 采用: 当前 definition identity 或 `definitionVersion` 与持久索引失配时明确拒绝读取，由领域从权威来源按当前定义完整重建；不自动迁移、不猜测兼容，也不回退到旧 parser。
- 采用: `definitionVersion` 不替代通用索引 schema version、source revision 或领域数据自身的版本字段，三类变化分别由各自 owner 判断。
- 不采用: 通过宽松读取、字段探测或来源内容相同来绕过定义失配，也不要求互相兼容的独立领域共享版本序列。
