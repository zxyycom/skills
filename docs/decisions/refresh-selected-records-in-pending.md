---
title: 按显式选择刷新记录的独立暂存版本
id: 261022-refresh-selected-records-in-pending
status: active
alignment: aligned
createdAt: 2026-10-22T04:28:32Z
purpose: 让连续暂存不同记录和重复刷新单条记录都保留未选工作。
background: 单文件索引中的不同记录需要独立组合，选中旧暂存不应成为静态冲突。
decision: 领域暂存以 pending 为基底，选中取当前完整版本，未选与并发状态受保护。
tags:
  - decision-records
  - investigation-report
  - responsibility-boundaries
  - version-control
relations:
  - type: 拆分
    target: 261010-investigation-local-validation-and-phase-facts
    summary: 独立承接局部依赖与阶段保护并采用选中刷新
---

## 目的

- 保留按记录 ID 独立构造待提交快照的能力，让连续暂存与重复选择具有稳定含义。
- 让未选任务的暂存修改、删除、文件表示以及并发结果受到保护。

## 背景

- 本判断只适用于 `skills/decision-records/` 与 `skills/investigation-report/` 的领域 stage。通用 [Index Runtime 暂存判断](stage-selected-index-entries-by-id.md)继续约束其他消费者。
- 一份完整 JSON 索引容纳多个任务的条目；将 HEAD 一律作为组合基底会丢失此前独立暂存的其他记录，将整个工作区作为基底又会夹带未选变化。
- 用户选择类似 git add 的刷新方式：明确选择 A 即采用 A 的当前完整版本，未选 B 保留原 pending；只需要对象级替换，不需要字段或正文片段合并。
- 静态已有暂存版本与本次准备后发生的并发漂移是不同事实：前者可以被显式刷新，后者仍须拒绝覆盖。
- [前序判断](archive/investigation-local-validation-and-phase-facts.md)同时维护只读检查与领域暂存。本判断完整承接暂存的局部依赖、资源安全和阶段保护，并扩展选中刷新；检查与普通维护边界由[发布基线判断](261024-bound-record-operations-to-published-facts.md)承接。

## 决策

- 采用: 领域暂存以本次捕获的 pending 为基底，在指定 scope 内刷新所选对象的当前完整版本，保持未选内容并独立保护并发状态。

- **按对象刷新**：以本次捕获的 pending 为组合基底，所选 ID 在指定 scope 内采用当前完整版本，未选条目保持原 pending。索引投影与来源 revision 一起更新，重复选择可替换该对象已有的部分暂存。
- **按 scope 承担结果**：index 只处理发布投影，领域文件由调用方配套；domain 只处理所选正文和受管 owner 资源，保留 pending 索引的字节或缺失状态；all 原子组合两者。
- **按已知位置清理**：从有效发布信息和必要的已变化 pending 身份恢复位置，清理所选旧路径；不重建全部 HEAD 正文，不为 stage 发现全部未同步工作区身份，也不增加持久变更清单或缓存。
- **依赖显式闭合**：合成索引继续满足集合 metadata、definition、关系图和资源 owner 声明约束；依赖缺失要求显式补选，身份更正同选旧、新 ID，不自动暂存其他 owner。
- **完整保护所选来源与树**：all／domain 按发布声明读取所选完整正文、直接资源与必要正式 owner，核对 ID、投影、来源指纹、路径、可见性与 owner 的直接引用。所选 owner 树包含未引用成员；准备与写前均在读取资源字节前核对根、owner 和全部路径分量，空树也执行。允许未引用基线成员的合法删除，未引用成员按安全普通文件路径检查。无关坏正文不形成局部门禁，未知位置的未同步身份重现交给显式检查／同步。
- **阶段复核与原子写入**：准备与写前分别取得并独立复核所选来源、工作区索引及完整 pending；锁内核对固定 HEAD 指针与完整 pending CAS。期间漂移或读取失败停止，保持范围外领域文件的字节、表示及 staged 删除；索引可规范化序列化，未选条目含义保持。
- **复用不可变事实**：固定 revision 的 HEAD 元数据与 owner 成员可复用，工作区成员、字节、执行位策略和 pending 在准备与写前分别取得；fileMode 关闭时复用本阶段完整表示依据。无关暂存路径从变化元数据报告，不为反馈重建全部 HEAD 正文。局部来源访问随所选对象、必要 owner 和局部成员增长；完整索引、图与 pending 仍有集合成本。
- **保持共享默认契约**：新行为由两域 stage owner 组合既有投影与 pending snapshot／patch 实现，通用 index-runtime stage 的默认契约不随领域放宽。
