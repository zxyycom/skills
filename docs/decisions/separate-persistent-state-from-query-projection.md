---
title: 分离持久状态与查询字段投影
id: 260905-separate-persistent-state-from-query-projection
status: active
alignment: aligned
createdAt: 2026-09-05T09:55:32Z
purpose: 让可重建索引只持久化领域状态，同时保留统一查询能力。
background: 持久查询值与领域状态重复，会扩大协议和同步维护面。
decision: Index Runtime 持久化状态快照并物化查询值，领域 definition 声明字段来源。
tags:
  - index-runtime
relations:
  - type: 修订
    target: maintain-rebuildable-read-side-index-boundary
    summary: 将查询投影移出持久索引
---

## 目的

- 让可删除重建的索引只保存领域 state snapshot，避免把同一查询值再作为持久事实维护。
- 让领域继续定义查询字段含义，同时复用统一的字段提取、查询与同步协议。

## 背景

- 查询 key 是从领域 state 和稳定 ID 得出的读侧投影；把它持久化会与 state 重复，并扩大 schema 与重建边界。
- 不同领域的字段路径、数组展开和时间规范化不同，但这些差异可以由封闭的 definition 描述，而不需要共享层取得领域语义或任意派生代码。

## 决策

- 采用: Index Runtime 持久化 `entries[id] = state`、metadata、definition identity 与 sourceRevision；reader 在内存中从 state 物化查询值，查询缓存和 runtime overlay 都不回写索引。
- 采用: 领域 definition 声明每个查询字段的 mode 与封闭 source descriptor，并继续拥有 state parser、字段来源含义、稳定 ID、完整领域校验及 sourceRevision currentness；共享运行时只验证、规范化、提取、缓存和查询这些声明。
- 采用: build、严格读取、sync 与 selected staging 对完整 state 集合执行相同的字段提取和领域校验；快速 currentness 仍只依赖领域提供的 sourceRevision。
- 不采用: 在持久索引复制查询值、让共享层解释领域字段语义，或接受动态代码、字符串表达式和任意查询派生规则。
