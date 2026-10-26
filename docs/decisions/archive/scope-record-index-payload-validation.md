---
title: 按消费范围验证两域索引暂存的 payload
id: 261022-scope-record-index-payload-validation
status: archived
alignment: aligned
createdAt: 2026-10-22T17:11:45Z
purpose: 让两域索引暂存承担相同内容验收，同时完整保护已有暂存身份与并发状态。
background: 两域索引暂存消费相同种类的发布投影，不应因独立编排承担不同的非索引内容验收。
decision: 两域 index scope 共用按索引路径验收与阶段协调，其他范围保持完整验证和领域责任。
tags:
  - decision-records
  - investigation-report
  - responsibility-boundaries
  - validation-boundaries
  - version-control
relations:
  - type: 修订
    target: 261022-scope-investigation-index-payload-validation
    summary: 保留完整保护与默认验证，将索引payload边界扩展到两域
---

## 目的

让 `skills/decision-records/` 与 `skills/investigation-report/` 的索引暂存按实际消费范围承担同一内容验收责任，同时保护完整 pending 身份、未选内容及并发状态。共同阶段义务只维护一处，领域合法性仍由各自 owner 负责。

## 背景

索引暂存只消费和修改索引 payload，领域正文与资源由调用方另行配套。完整 pending 的路径、模式及对象 ID 表达未选条目的身份保持，但不证明其 payload 即时可读或具有有效内容指纹。

[前序判断](scope-investigation-index-payload-validation.md)已为 Investigation 的 `index` scope 采用按索引路径验收，并保留其他范围的完整验证。Decision 的同类操作承担相同结果，不应继续为未消费的全部非索引对象验收内容。两域分别维护相同 scope 策略和准备、复核、发布顺序，也容易让保护边界再次分叉。

本判断把既已采用的索引验收边界扩展到两个领域，不改变[独立暂存刷新](refresh-selected-records-in-pending.md)的 P-base 选择语义、领域来源与资源约束，也不扩展到普通查询、维护事务或其他 Index Runtime 消费者。

## 决策

- 采用: **按消费范围验收。** 两域 `stage --scope index` 显式按目标索引路径验收 payload。完整受管 pending 的路径、模式、对象 ID 与 staged 删除仍受保护；非索引对象不承担即时可读性及内容指纹验收，也不因此证明工作区或 pending 正文的语义正确。`all`／`domain` 及其他 pending 消费者继续默认验证完整 scope 的实际 payload，只保留所需字节。
- **共同 owner 与领域适配。** 共同 scope 策略与准备、独立 fresh 复核、受保护发布收口在既有 Index Runtime 的内部记录暂存协调器。领域通过窄适配提供 selector、合法位置、正式来源、依赖和写集；决策生命周期／演进图与调查认识关系／资源 owner 各自验证。CLI 结果 DTO 保持各自兼容，通用 `stageSelectedIndexEntries` 的默认基底与验证责任不变；协调器仅服务这两个现有消费者，不引入通用记录框架或 provider 协议。
- **snapshot 比较与更新。** opaque snapshot 比较要求 repository 实例、scope 与 payload 策略一致；按路径验收时内容路径集合也须一致，默认完整验证允许不同保留集。策略内对象须完整读取并取得实际指纹，所需对象缺失、类型错误或腐败仍失败；按路径验收的更新限于原声明路径。OID 不能冒充实际 payload 指纹。
- **阶段事实。** 准备阶段复用同次已捕获的 pending；所需路径已覆盖时不重复捕获，仅缺少领域依赖字节时允许同阶段扩展保留集，并核对 snapshot 等价。写前独立读取并验收本阶段真实 W/P payload、完整 snapshot 身份及 scope 所需来源、文件表示和目录事实；仅有 OID 或前阶段通过的结论不足以完成本阶段验收。
- **调用内纯计算复用。** 新鲜实际内容与完整身份、固定 definition／H 及选择均证明等价后，允许复用本调用已验证的不可变解析与确定性目标。差异或非法输入保留原有验证及错误优先级。固定 H revision 的不可变投影及纯 H 派生事实也可调用内复用；可变来源、文件表示和目录仍独立 fresh 验收，所有复用均不扩展为跨调用缓存。
- **受保护发布。** 锁内核对 fresh HEAD 与完整 pending CAS，写后按原策略验证目标并保护范围外状态，unchanged 路径同样通过保护。索引结构保持不变。
- **其他读取契约。** revision prefix 仍完整读取所选对象并显式报告内容是否完整；前缀不足以判断语义时，以同一固定 revision 补读。通用 full-read/full-replacement 的默认保证不变。
- **成本与契约入口。** 分别判断 payload I/O、保留与复制、完整成员及关系图、物理事务复制和条件补读；按路径验收不意味着全流程仅随所选对象增长。共享 API 由[版本管理中间层](../../../tools/shared/version-control.md#完整验证与选择性内容保留)承接，共同阶段由 [Index Runtime](../../../tools/index-runtime/README.md#记录领域的内部暂存协调)承接；公开 scope 与领域保证由 [Decision](../../../skills/decision-records/references/cli-operations.md#待提交快照)及 [Investigation](../../../skills/investigation-report/references/cli-operations.md#待提交快照)操作契约承接。
