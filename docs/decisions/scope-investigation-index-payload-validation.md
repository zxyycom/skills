---
title: 按消费范围验证调查索引暂存的 payload
id: 261022-scope-investigation-index-payload-validation
status: active
alignment: aligned
createdAt: 2026-10-22T06:21:35Z
purpose: 让调查索引暂存只承担索引内容验收，同时完整保护已有暂存身份与并发状态。
background: 只修改索引的操作需要保留完整暂存身份，但不需要证明所有非索引对象即时可读。
decision: 仅调查 index scope 按所需索引路径验收 payload，其他范围保持默认完整验证与阶段保护。
tags:
  - investigation-report
  - responsibility-boundaries
  - validation-boundaries
  - version-control
relations:
  - type: 修订
    target: 261010-retain-complete-validation-with-selected-content
    summary: 保留默认完整验证，仅调查index按消费范围验收payload
---

## 目的

让 `skills/investigation-report/` 的索引暂存按实际消费范围承担内容验收，同时保护完整 pending 身份、未选内容及并发状态。共享层的默认完整验证和其他消费者的验收责任继续有效。

## 背景

索引暂存只消费和修改索引 payload，领域正文与资源由调用方另行配套。完整 pending 的路径、模式及对象 ID 足以表达未选条目的身份保持，但不能证明其 payload 即时可读或具有有效内容指纹。把这两种责任等同，会让仅索引操作承担并未消费的全部对象内容验收。

前序判断确立完整实际 payload 验证与选择性保留分离，避免把少保留误认为少验证。本判断保留该默认方向及 revision prefix 的完整读取责任，仅为调查 `index` scope 选择不同的 payload 验收边界；它不改变 `all`／`domain`、其他工具或通用 full-read/full-replacement 的默认保证。

## 决策

- 采用: 共享 pending snapshot 将完整身份保护、payload 验证策略与内容保留分开声明。默认验证完整 scope 的实际 payload；只有 `skills/investigation-report/` 的 `stage --scope index` 显式按目标索引路径验收 payload，非索引 pending 保留完整路径、模式、对象 ID 与 staged 删除，不承担即时可读性及内容指纹验收。该操作也不证明工作区或 pending 正文的语义正确。
- opaque snapshot 的比较要求 repository 实例、scope 与 payload 策略一致；按路径验收时还要求内容路径集合一致，默认完整验证允许不同保留集。策略内对象须完整读取并取得实际指纹，所需对象缺失、类型错误或腐败仍失败；按路径验收的更新限于原声明路径。
- 准备阶段复用同次已捕获的 pending；写前独立复核可变事实，锁内核对 fresh HEAD 与完整 pending CAS，写后按原策略验证目标并保护范围外状态。单阶段复用不扩展为跨调用缓存，索引结构保持不变。
- 其他 pending 消费者及调查 `all`／`domain` 继续完整验证实际 payload，仅保留所需字节。revision prefix 完整读取所选对象并显式报告内容是否完整；前缀不足以判断语义时，以同一固定 revision 补读。
- 成本验收分别判断 payload I/O、保留与复制、完整成员及关系图、物理事务复制和条件补读；按路径验收不意味着全流程仅随所选对象增长。当前共享 API 与领域操作边界分别由[版本管理中间层](../../tools/shared/version-control.md#完整验证与选择性内容保留)及[调查暂存契约](../../skills/investigation-report/references/cli-operations.md#待提交快照)承接。
