---
title: 完整内容验证与选择性保留分离
id: 261010-retain-complete-validation-with-selected-content
status: active
alignment: aligned
createdAt: 2026-10-10T18:05:07Z
purpose: 在减小快照内存与复制成本时保留完整范围失败和漂移保护。
background: 阶段快照需要完整身份保护，但领域通常只消费所选路径或身份前缀。
decision: 以共享专用原语分离完整实际payload验证、opaque快照身份和所需内容保留。
tags:
  - investigation-report
  - responsibility-boundaries
  - version-control
relations: []
---

## 目的

让需要完整范围漂移保护的操作只保留实际消费的内容，同时明确优化不能默默改变对象读取失败语义。适用于共享版本管理层及其 Investigation Report 消费者，不改变其他 skill 的领域规则。

## 背景

待提交范围包含干净和未选条目，完整文件快照在多个阶段反复保存、按路径复制全部 payload。历史身份检查只消费 Markdown 前三行，却保存并解码所有历史正文。对象 metadata 无法证明实际 payload 可读：尾部截断的 blob 可以通过 batch-check 而真实 batch 读取失败。仅比较对象标识也不能保留实际字节漂移检测。

## 决策

- 采用: 完整验证与选择性内容保留分离：共享层通过专用 pending snapshot 与 revision prefix 原语维护完整读取及身份保护，领域消费者只取得所需内容。这样可以减少保留、复制和解码，而不改变对象读取失败与漂移判定。

1. pending snapshot 由共享层绑定到同一 repository 实例与 scope，内部保存完整成员、表示及实际 payload 指纹；领域只消费路径、表示和所选字节。锁内核对 fresh HEAD、完整范围 CAS，写后验证实际内容，并保护范围外状态。
2. 每个验证阶段流式校验完整实际 payload，只保留显式路径或有限前缀。metadata 或对象标识不能替代实际字节可读性与漂移证据；对象缺失、类型错误和腐败仍按读取契约失败。
3. 前缀原语显式返回内容完整性。消费者按该事实判断语义是否足够，不足时以同一确定 revision 补读。专用原语不扩展通用 repository 接口，通用 full-read/full-replacement 保持默认契约。
4. 性能验收分别核对 payload I/O、内容保留与复制、完整成员与关系图、物理事务复制及条件 fallback；不把选择性保留解释为全流程成本仅随选中对象增长。

当前 API 与失败契约由[版本管理中间层](../../tools/shared/version-control.md#完整验证与选择性内容保留)承接；选择依据的反例和测量条件见[调查报告](../investigations/investigation-phase-facts-and-streamed-content.md)。
