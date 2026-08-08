---
title: 以稳定 ID 键控状态索引
status: active
alignment: aligned
createdAt: 2026-08-06T09:23:47Z
purpose: 让索引从领域输入到持久化都直接按稳定 ID 管理条目，并保持低成本的新鲜度检查。
background: 决策形成时的数组需要再次推导身份，整体来源摘要又无法在选择部分条目时安全组合。
decision: 身份集合统一使用 ID 键控对象，来源 revision 按 metadata 与各 ID 分解，快速读取保持单次轻量扫描。
relations:
  - type: 拆分
    target: index-runtime/stage-selected-index-entries.md
---

## 目的

- 让领域在已经知道稳定 ID 的边界直接提供身份，通用索引不再从 state 中重复推导。
- 让持久化条目、运行时覆盖和来源状态能够按同一个 ID 直接获取、校验和组合。
- 保留索引查询前低成本判断来源是否变化的能力，不因条目可组合性退化为完整领域解析。

## 背景

- 决策形成时，snapshot、持久化 entries 和 runtime overlay 使用数组，definition 再通过 `identify` 从 state 恢复 ID；运行时随后仍需建立映射或扫描条目。
- 当时 decision-records、investigation-report 和 test-evidence 在领域读取阶段已经拥有稳定路径或 case ID，数组和二次身份推导没有承接真实责任边界。
- 单一的整体 `sourceRevision` 可以快速判断完整来源是否变化，却不能只凭 revision 与工作区两份索引组合选中条目的来源状态。
- 用完整 state 投影摘要替代来源 revision 会要求常规新鲜度检查重新解析全部领域源，削弱索引用于快速读取的核心价值。

## 决策

- 采用: 状态索引的 snapshot states、持久化 entries、runtime overlay 和逐条来源 revision 统一使用稳定 ID 键控对象；对象键是通用索引的唯一权威身份，definition 不再提供 `identify`。
- 采用: state parser 与 key 策略直接获得当前 ID 和只读 metadata 上下文。state 内容继续由领域拥有；领域可以保留同值的 `path` 或 `id` 字段，但通用层不从中恢复身份。
- 采用: 通用索引升级为 schema v3，持久化 `entries[id]` 只保存 `state` 和派生 `keys`。reader 的有序查询结果仍显式附加 ID 并使用数组；key definitions、多值 key 和领域数组继续保留其原有顺序语义。
- 采用: `sourceRevision` 保存 metadata 来源指纹和按 ID 键控的条目来源指纹。其 ID 集合必须与 states 或 entries 完全相同；领域负责让任何可能改变对应投影的来源变化改变相关指纹，通用层只比较和组合不透明值。
- 采用: 完整 source read 与快速 `readRevision` 返回同一 revision 结构。快速路径只在一遍来源发现与读取中计算指纹，不调用领域 state parser、key 投影或完整索引构建；同一 reader 打开后的读取不重复检查。
- 采用: id record 的序列化结果确定且不依赖输入顺序。索引 JSON 按标准 JSON 语义解析，再校验 Schema、ID 合法性以及 `entries` 与 `sourceRevision.entries` 的成员一致性；通用边界统一处理原型敏感键。schema v2 不进入兼容读取分支，由各领域从权威来源重建 schema v3 派生索引。
- 采用: 字典化只承诺直接身份操作和可组合来源状态；普通过滤、全文匹配、排序和完整校验仍可遍历全部条目，不据此引入倒排索引、缓存或 watcher。
