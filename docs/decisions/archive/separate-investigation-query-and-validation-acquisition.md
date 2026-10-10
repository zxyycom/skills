---
title: 分离调查快照查询与来源验证的读取职责
id: 261010-separate-investigation-query-and-validation-acquisition
status: archived
alignment: aligned
createdAt: 2026-10-10T07:11:23Z
purpose: 让调查发现按发布快照查询，局部读取按需取源，全集验证与写前复核各承担必要证据。
background: 查询前核对全集与逐条重建资源依据混淆了读取职责，放大正文访问和 Git 进程而未提供相应结果价值。
decision: Investigation Report 按结果需要取得来源，批次内复用身份与资源事实，写入阶段独立重读，资源字节仍不参与报告索引。
tags:
  - investigation-report
  - performance
  - responsibility-boundaries
  - validation-boundaries
relations:
  - type: 修订
    target: exclude-investigation-resources-from-report-index-revision
    summary: 保留资源排除，改由全集验证核对来源，快照查询不读原文
---

## 目的

- 适用于 `investigation-report`（`skills/investigation-report/`），让查询、局部读取、全集验证和写入分别获取其结果需要的证据。
- 保留报告索引与资源字节身份的分离，避免将发现入口扩张为维护入口。

## 背景

- 发布索引保存报告身份、元数据、关系、资源引用和报告 Markdown 来源指纹。快照内合法查询不需要证明工作区全集仍与发布时相同。
- 逐候选重建集合身份和资源引用、逐 owner 探测 workspace/HEAD、逐文件读取 Git 执行位策略，重复了同一阶段共同依赖的事实。
- 局部验证只能证明选定源与直接约束；写入则需要必要的全集合法性以及准备到写前复核之间的漂移保护。以减少读取为由取消这些证据会改变正确性。

## 决策

- 采用：`list`、`trace`、`search --in metadata` 只严格解析发布索引并查询该快照；不读报告或候选正文，不自动同步，不默认输出未核对 warning。metadata search 的来源为 `published-index`、`currentness: unchecked`、`fallback: false`，不声称当前源仍一致。
- 采用：`show` 按发布路径读取一个普通报告文件并核对 ID；来源指纹漂移只表达该条快照正文边界。局部 `check` 优先用索引定位选定源，移动或新增身份需要时再发现；不顺带证明全集、索引或无关候选健康。
- 采用：单一阶段复用已经取得的源字节、解析结果、身份映射和资源验证依据。候选读取保留正式与候选 owner 的资源可见性，仅按需要读取正式 owner；共享资源依据每阶段构建一次，不依赖全局或持久缓存。
- 采用：全量 `check` 与 `sync-index` 承担完整集合、关系、资源与索引对齐，并保留结束来源复核。content search 仍由当前权威正文形成完整结果，并保留现有 fallback 与错误边界；不改变其他 skill 的查询行为。
- 采用：`stage --scope domain` 先验证必要全集，再在准备及写前复核阶段分别批量取得所选报告与 owner 的 workspace/HEAD 资源成员、字节与执行位表示。两阶段独立读取，继续拒绝身份、资源可见性、成员、字节、执行位、HEAD、pending 或来源漂移。
- 采用：前序历史诊断在没有前序关系时不探测 Git；HEAD 没有报告时显式返回空来源，不把空路径误解释为整个仓库。
- 保留：每个报告 state 保存其声明的 resource IDs；报告资源链接变化使 entry 与报告 source revision 变化。索引 metadata 保持严格空对象，不保存资源 ID、SHA-256、引用计数或资源状态；资源成员、路径和字节不参与 source revision。
- 保留：当前资源完整性由完整验证与相应局部检查承接，形成时字节身份由 Git 历史及报告证据承接。单纯资源字节变化不要求同步报告索引，索引不提供资源哈希审计。
