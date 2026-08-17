---
title: 让调查资源退出主题索引来源版本
status: active
alignment: unaligned
createdAt: 2026-08-17T08:03:12Z
purpose: 让调查主题索引只投影报告事实与资源引用关系，不再用集合级 metadata 跟踪资源文件成员和字节。
background: 资源哈希能够暴露文件变化，但把全部资源纳入 metadata 和 source revision 会让查询索引承担资源快照清单职责。
decision: 保留主题 state 的资源引用，移除资源 metadata 与字节 revision；当前完整性由检查维护，形成时身份由 Git 与报告证据承接。
tags:
  - investigation-report
relations:
  - type: 拆分
    target: attach-verifiable-resources-to-investigation-reports.md
---

## 目的

- 让 `investigation-index.json` 保持为调查主题的可删除重建查询投影，不扩张为随附资源内容清单。
- 保留报告到资源 ID 的可查询关系，同时让没有改变主题 Markdown 的资源文件变化不再使主题索引陈旧。
- 分离主题查询投影、当前资源完整性和形成时字节身份的维护责任。

## 背景

- 报告 Markdown 是资源引用关系的事实源，主题 state 投影报告序号与资源 ID 可以支持查询；资源文件字节不是 topic state 或 query key。
- 当前 `metadata.resources` 和 `sourceRevision.metadata` 覆盖全部资源成员及 SHA-256，因此任何资源变化都会使主题查询索引失效。
- SHA-256 只能比较字节，不能证明材料来源、内容充分性或修改正当性。形成时字节可以由 Git 快照保存，报告正文仍负责说明材料怎样支持调查结果。

## 决策

- 采用: 主题 state 继续保存每份报告声明的 `resourceReferences`；报告增加、删除或改变资源链接时，对应 topic entry 与 entry source fingerprint 必须变化。
- 采用: 调查领域 metadata 收敛为空对象，不保存资源 ID、SHA-256、引用计数或资源状态。资源成员、路径名称和文件字节不参与 `sourceRevision.metadata`，也不决定 `list` 的索引新鲜度。
- 采用: 索引领域校验不再从 metadata 检查资源引用、orphan 或内容漂移。[未引用资源诊断决策](warn-on-unreferenced-investigation-resources.md)定义默认 check 与同步前校验；`list` 只核对主题 Markdown 对应的索引 revision。
- 采用: 资源形成时字节身份由 Git 历史和报告证据说明承接。资源内容变化不要求 `sync-index`，主题查询索引也不提供资源哈希审计。
- 采用: Metadata 与 source revision 来源变化属于不兼容的调查索引契约变化；实施时提升领域 definition version 并重建索引，不增加旧 metadata 双读、转换器或兼容分支。
