---
title: 使用稳定 ID 键控索引身份
status: active
alignment: aligned
createdAt: 2026-08-11T03:24:19Z
purpose: 让来源快照、持久条目和运行时覆盖沿用同一稳定身份，并消除从 state 二次推导 ID 的责任。
background: 领域读取阶段已经知道稳定身份，数组与二次 identify 会重复工作并增加组合、校验和直接读取成本。
decision: 索引身份集合统一使用安全的 ID 键控对象，对象键是通用边界的唯一权威身份。
tags:
  - index-runtime
relations:
  - type: 拆分
    target: use-id-keyed-state-index.md
---

## 目的

- 让领域在发现稳定 ID 的边界直接提供身份，并让索引各阶段按同一 ID 获取、校验和组合条目。
- 让身份责任与来源新鲜度责任能够独立演进和判断对齐。

## 背景

- 领域读取通常已经从路径、记录键或受控标识得到稳定 ID；把 state 放入数组后再由 definition 恢复身份会重复责任。
- 持久索引和运行时覆盖最终仍需要按 ID 查询或建立映射，数组身份会增加扫描和组合成本。
- State 可以合法包含领域拥有的 `id` 或 `path` 字段，但这些字段不应成为通用运行时的隐式身份协议。

## 决策

- 采用: 来源 snapshot 的 states、持久化 entries 和 runtime overlay 统一使用 `id -> value` 对象；对象键是 Index Runtime 的唯一权威身份，definition 不再从 state 二次 identify。
- 采用: 通用边界在调用领域 parser 和 key 策略前校验 ID，并把当前 ID 与只读 metadata 一起作为上下文传入；领域 state 中同名字段仍由领域解释。
- 采用: Reader 的单条读取直接按 ID 获取，排序和分页查询仍返回显式携带 ID 的有序结果，不把对象成员顺序变成查询语义。
- 采用: ID record 使用安全的 own-property 构造和读取，允许符合文本契约的原型敏感键；序列化结果确定且不依赖输入对象的插入顺序。
- 不采用: 因 ID 键控而承诺普通过滤、全文搜索、排序或完整校验不遍历条目，也不据此引入倒排索引、缓存或 watcher。
