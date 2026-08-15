---
title: 使用稳定 Decision ID、tags 与定位索引
status: active
alignment: aligned
createdAt: 2026-08-15T03:14:02Z
purpose: 让决策身份、分类、当前来源位置和生命周期能够独立演进，避免分类或归档移动改变记录身份。
background: 领域目录路径同时承担身份、唯一归属、查询和定位时，分类调整与归档会扩大为关系、索引和引用迁移，且无法用多维分类表达实际内容。
decision: 以 Markdown basename 作为稳定 Decision ID，以非空记录级 tags 分类，以索引 sourcePath 定位，并以受检位置投影物理归档边界。
tags:
  - decision-records
relations:
  - type: 归并
    target: classify-decisions-by-controlled-domain-path.md
  - type: 归并
    target: project-domains-into-decision-queries.md
  - type: 修订
    target: use-persisted-index-for-routine-queries.md
  - type: 修订
    target: query-candidates-directly-from-source.md
  - type: 替代
    target: upgrade-decision-domains-after-real-pressure.md
---

## 目的

- 让分类调整、当前来源移动和归档不再改变一条决策的稳定身份或关系目标。
- 让查询和维护使用可直接解析的 Decision ID，并通过单一派生索引恢复当前来源位置。
- 让归档路径为通用文件工具提供可整体排除的生命周期投影，同时保留完整集合的回放与演进能力。

## 背景

- 领域目录路径同时表达唯一领域、记录身份、查询筛选、关系目标和物理位置时，任一分类重组都会连带迁移这些不应由分类决定的责任。
- 一条长期判断可能需要多个彼此独立的分类维度；将分类限制为唯一目录归属会迫使维护者在身份迁移与信息丢失之间取舍。
- 持久索引已经适合作为常规查询快照，候选仍需从权威 Markdown 容错发现；两者都需要与身份无关的当前位置定位，不能把索引反向当作来源事实。
- 已归档记录需要离开常规搜索路径，但移动目录只有在身份、关系、索引、生命周期和待提交快照不再以路径为身份后才安全。

## 决策

- 采用: 决策 Markdown 的 basename（含 `.md`）是全集合唯一且稳定的 Decision ID；目录移动不改变 ID，basename 改变是显式身份迁移。关系、查询、生命周期和选择性暂存以 Decision ID 指向记录，不以领域路径或当前位置充当身份。
- 采用: 每条权威 Markdown 直接保存至少一个有序且唯一的 tag。tags 只承接分类，不编码 status、alignment、关系类型、生命周期位置或当前事实；重复 tag 查询使用同时满足全部 tag 的交集语义。
- 采用: 持久索引以 Decision ID 为键，并保存唯一的 `sourcePath` 作为当前来源定位。`list`、`show` 和 `trace` 继续直接读取该受检快照，`show` 只额外读取目标正文；`check`、同步和生命周期事务继续负责完整来源、关系与索引的一致性。
- 采用: candidate 与 active 记录直属决策根，archived 记录直属统一 `archive/` 边界。Markdown `status` 是生命周期权威，位置和索引是必须一致的受检投影；候选源码发现及逐文件容错继续独立于正式索引。
- 采用: 分类重组通过记录级 tags 演进，不保留领域目录表、唯一领域路径、领域查询或领域谱系作为并行分类与身份机制。已归档记录仍保留正文、关系和最后生命周期状态，显式历史查询与关系追踪继续覆盖它们。
- 不采用: 由路径、目录表或索引 state 共同定义身份或唯一分类。它们会让分类、当前位置和身份形成可独立漂移的多份事实，并使归档移动破坏关系与查询定位。
- 不采用: 预先登记全部合法 tag、维护 tag 层级或别名，或为旧领域路径、旧索引 Schema 和旧查询参数保留兼容读取。分类事实只保存在记录，目标模型只维护一套当前契约。
