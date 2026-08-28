---
title: 让调查资源退出报告索引来源版本
status: active
alignment: aligned
createdAt: 2026-08-28T10:12:54Z
purpose: 让报告索引只投影报告事实与资源引用关系，不把资源文件成员或字节纳入索引来源版本。
background: 资源字节变更不改变报告 Markdown 的形成时认识；新索引以单报告 Investigation ID 而非主题为投影单位。
decision: 保留报告 state 的资源引用，排除资源 metadata 与字节 revision；资源完整性由检查维护，形成时字节身份由 Git 与报告证据承接。
tags:
  - investigation-report
relations:
  - type: 修订
    target: exclude-investigation-resources-from-index-revision.md
---

## 目的
- 让 investigation-index.json 保持为可删除重建的报告级查询投影，而不扩张为资源内容清单。
- 保留报告到资源 ID 的可查询引用，同时避免未改变报告 Markdown 的资源字节变化使索引陈旧。
- 分离报告查询投影、当前资源完整性和形成时资源字节身份的维护责任。

## 背景
- 报告 Markdown 是资源引用关系的唯一事实源，报告 state 投影 resource IDs 即可支持查询；资源文件字节不是报告 state 或 query key。
- 将资源成员、SHA-256 或引用计数放入索引 metadata 会让资源任意变化阻塞报告查询索引的读写与新鲜度。
- 资源内容是否安全、可分发和被正确引用仍需严格验证，但这些事实不需要由索引 revision 代为保存。

## 决策
- 采用: 每个报告 state 保存其声明的 resource IDs；新增、删除或改变报告资源链接时，对应报告 entry 与 source revision 必须变化。
- 采用: 索引 metadata 保持为空对象，不保存资源 ID、SHA-256、引用计数或资源状态。资源成员、路径名称和文件字节不参与 source revision，也不决定 list 的索引新鲜度。
- 采用: 默认 check 与 sync-index 继续校验被引用资源及未引用资源诊断；list 只核对报告 Markdown 对应的索引 revision，不把资源字节变化解释为索引陈旧。
- 采用: 资源形成时字节身份由 Git 历史和报告正文证据承接。资源内容变化不要求 sync-index，报告索引不提供资源哈希审计。
- 采用: 报告级来源定义是一次不兼容索引契约切换，实施时重建索引；不保留旧 metadata 双读、转换器或兼容分支。
