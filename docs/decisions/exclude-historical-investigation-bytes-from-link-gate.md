---
title: 将调查形成时字节排除出持续链接门禁
id: 261004-exclude-historical-investigation-bytes-from-link-gate
status: active
alignment: aligned
createdAt: 2026-10-04T15:28:54Z
purpose: 让持续链接门禁证明当前可维护 Markdown 的可用性，不把历史材料的后续目标漂移变成修写义务。
background: 调查随附资源保存形成时字节；对其持续追逐当前链接目标会扭曲历史依据并混淆资源完整性责任。
decision: Vibe 的 Markdown 链接门禁排除调查资源，当前可维护 Markdown 继续受检；资源引用与完整性由调查领域维护。
tags:
  - investigation-report
  - project-tooling
  - validation-boundaries
relations:
  - type: 修订
    target: exclude-formation-time-link-bytes-from-validation
    summary: 保留形成时字节边界，按当前 Vibe 链接门禁承接
---

## 目的

- 让主仓库持续链接门禁服务当前可维护 Markdown，不要求调查形成时材料随当前 owner 或链接目标变化而改写。
- 让当前文档链接可用性与历史资源引用、身份和完整性各由适当 owner 验证。

## 背景

- `docs/investigations/_resources/` 保存调查形成时字节；后来仓库结构或外部链接变化不表示原调查当时的依据错误。
- 资源仍需被安全引用并满足调查领域完整性要求；退出全仓链接扫描不表示退出受管证据集合。
- 当前全仓 Markdown 链接门禁由 Vibe 的原生 Check 承接，根结构校验入口不承担同一链接扫描责任。

## 决策

- 采用: Vibe 的原生 `markdown-link-validation` 是当前维护 Markdown 链接的唯一全仓 owner，按项目选定范围受检，并排除 `docs/investigations/_resources/**` 的形成时材料；具体文件选择和入口由项目工具链拥有。
- 当前可维护正文继续接受链接门禁。历史材料的保留价值不豁免当前正文，也不要求通过改写形成时资源消除后续链接漂移。
- 被报告引用的资源由 Investigation Report 的资源引用与完整性门禁维护，继续核对路径、归属和普通文件身份。两类门禁分别证明当前文档可用性与历史资源完整性。
