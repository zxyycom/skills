---
title: 分离决策激活生效与 HEAD pending 标记
status: active
alignment: aligned
createdAt: 2026-07-22T08:48:05Z
purpose: 让活动决策从激活时起立即约束后续工作，同时只用 HEAD 区分路径是否进入正式历史。
background: 把生效绑定到 HEAD 会让已激活记录在提交前失去约束力，也会把临时查询标记误解为持久生命周期。
decision: 活动记录激活即生效，HEAD 只决定路径是否临时显示 pending；pending 不改变确认、生命周期、对齐或生效状态。
relations:
  - type: 修订
    target: decision-records/derive-pending-from-head-path.md
---

## 目的
- 让已经激活的活动决策无论是否提交都立即成为当前有效判断。
- 让 `pending` 只表达路径尚未进入正式 Git 历史，不承担确认、生命周期、对齐或生效语义。
- 保留提交前原地收敛和放弃新记录的能力，同时避免把中间方案制造成正式演进前序。

## 背景
- `activate` 已经明确目标记录和对齐状态，并在首次激活时写入权威创建时间；命令成功后记录已成为活动集合成员。
- Markdown 路径是否存在于 `HEAD` 只能证明该身份是否进入正式版本历史，不能证明用户是否确认判断，也不能决定活动记录是否有效。
- 把 `active [pending]` 描述为“准备采用”会推迟有效决策的约束力，并与活动且未对齐决策已经生效的语义冲突。
- 提交前记录仍可能原地收敛或被放弃；历史关系目标则需要已经进入 `HEAD` 的稳定身份。

## 决策
- 采用: 活动记录在 `activate` 成功后立即生效；`aligned` 或 `unaligned` 只表达当前事实是否达到目标，不改变生效判断。
- 采用: CLI 始终查询当前工作区记录，`HEAD` 只按 Markdown 路径是否存在决定临时 `pending`；`git add` 不改变该标记。
- 采用: `pending` 不写入 Markdown、索引、缓存或隐藏状态，也不改变确认、生命周期、对齐或生效状态。
- 采用: `active [pending]` 表示已经激活并生效但尚未进入正式 Git 历史的记录；它可以在首次提交前原地收敛或通过 `discard` 放弃。
- 采用: `archive` 拒绝 pending 记录，历史关系目标必须已经归档且路径存在于 `HEAD`；pending 记录不能充当正式历史前序。
- 采用: CLI 不从 `HEAD` 读取另一份索引或正文，不推断重命名；已建立路径从工作区消失时严格失败。
