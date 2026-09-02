---
title: 将调查 authoring candidate 与已建立报告分离
status: active
alignment: aligned
createdAt: 2026-09-02T07:21:10Z
purpose: 让调查报告在正式建立前拥有可审阅的根目录 authoring workspace，并保持正式集合边界明确。
background: 完整报告写入根目录即建立，机械问题只能在进入正式集合后发现；子目录候选会破坏相对资源链接。
decision: 用根目录 `_candidate.<investigation-id>` 保存集合外候选；共用资源链接但不进入 lifecycle、正式查询或索引，readiness 不构成授权。
tags:
  - investigation-report
relations: []
---

## 目的

- 让维护者先创建、编辑和机械审阅完整形状的调查报告，而不把未完成内容误作为正式报告。
- 保持调查关系只表达形成时认识演进，不借 candidate、relation 或 readiness 引入报告 lifecycle。
- 保持 candidate 与正式报告的 `./_resources/<resource-id>` 链接字节一致，避免发布时改写 Markdown 或搬迁资源。

## 背景

- 正式报告的根目录 Markdown 是形成时认识的权威来源，且写入即属于正式集合。
- 正文、资源和关系需要在建立前收敛，但此前没有一个既不混入正式报告又能复用同一资源路径的 authoring 位置。
- 关系模型已经固定：补充、复查、修正、推翻、归并和拆分不产生归档、隐藏或删除效果。

## 决策

- 采用: 使用唯一保留 basename `_candidate.<investigation-id>` 保存 candidate；该文件不匹配正式 Investigation ID，不进入正式索引、`list`、`show`、`trace` 或 `stage-index`。
- 采用: candidate 使用正式 frontmatter、固定章节与资源链接语法；`scaffoldValid`、`bodyReady`、`resourceReady` 与 publish preflight 只表达机械准备事实，不证明语义质量、关系真实性、资源价值或建立授权。
- 采用: candidate 与正式报告共享根目录 `_resources/`。candidate 可以直接拥有最终 `<investigation-id-stem>/...` 路径中的资源，或共享已建立 owner 的资源；publish 不改写链接、不搬迁或自动暂存资源。
- 采用: candidate 通过 `new` 创建、通过 `publish` 建立或通过 `discard-candidate` 显式清理；它不是 status、archive 或 active/archived lifecycle 的另一种形式。
- 不采用: 以子目录隔离 candidate、用索引保存 candidate、从 readiness 推断语义审核，或让 candidate/关系自动改变正式报告的可见性与生命周期。
