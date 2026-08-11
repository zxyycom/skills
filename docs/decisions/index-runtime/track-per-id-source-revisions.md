---
title: 按集合元数据与条目 ID 跟踪来源 Revision
status: active
alignment: aligned
createdAt: 2026-08-11T03:24:19Z
purpose: 让索引能够独立组合条目来源状态，同时保留查询前低成本判断持久投影是否新鲜的能力。
background: 单一整体摘要不能安全组合部分条目，而以完整 state 投影求摘要会让常规新鲜度检查退化为完整领域解析。
decision: 来源 revision 分为 metadata 指纹和逐 ID 条目指纹，完整读取与轻量读取返回同一闭合结构。
relations:
  - type: 拆分
    target: index-runtime/use-id-keyed-state-index.md
---

## 目的

- 让集合级来源和逐条来源可以分别比较与组合，并确保 revision 与索引成员保持闭合。
- 保留 reader 打开时低成本核对来源新鲜度的能力，不要求重建完整领域投影。

## 背景

- 一个整体 source revision 可以判断完整来源是否变化，却不能支持只选择部分 ID 时组合来源状态。
- 若 revision 从解析后的完整 state、keys 或索引文本派生，普通查询前的新鲜度检查就必须重复领域解析与投影。
- 集合 metadata 与单个条目由不同来源变化驱动，需要分别定位变化，同时仍属于同一来源快照。

## 决策

- 采用: `sourceRevision` 保存 metadata 的不透明来源指纹和按稳定 ID 键控的条目来源指纹；其条目 ID 集合必须与 snapshot states 或持久化 entries 完全一致。
- 采用: 领域负责保证任何可能改变 metadata 投影的输入都会改变 metadata 指纹，任何可能改变成员、state 或 keys 的输入都会改变、增加或删除对应 ID 指纹；通用层只比较和组合这些不透明值。
- 采用: 完整 `read` 与快速 `readRevision` 对同一来源返回相同的结构化 revision。快速路径只做一次来源发现和内容读取，不调用 state parser、key 投影、完整索引构建或 `validateIndex`。
- 采用: Reader 打开时核对一次当前 revision；成功绑定快照后，同一 reader 的读取不重复检查，需要观察新来源状态时重新打开。
- 不采用: 用完整 state 投影摘要替代来源 revision，或让调用方为逐 ID 组合另行补造整体 revision。
