---
title: 删除 prompt-optimize 迁移副本
status: active
alignment: aligned
createdAt: 2026-07-20T10:15:36+08:00
purpose: 让 prompt-optimize 的分发内容只保留当前执行和解释需要的入口与引用。
background: "`workflows.md` 和 `rewrite-rules.md` 已长期不参与主动读取, 核心流程已由 `SKILL.md` 稳定承接, 决策记录和 Git 历史足以回放旧结构。"
decision: 保持 `SKILL.md` 作为压缩后的默认流程 owner, 保留 `principles.md` 解释长期理由, 删除两份迁移副本并停止随包分发。
relations:
  - type: 修订
    target: prompt-optimize-references/260701-compact-entry-and-archive-migration-copies.md
---

## 目的
- 保持 prompt-optimize 的最小分发内容与当前行为契约一致。
- 让历史回放由决策记录和 Git 历史承接, 不让失效副本继续占用引用结构和分发包。

## 背景
- `workflows.md` 和 `rewrite-rules.md` 在核心流程合并回入口后只作为稳定期迁移副本保留。
- 两份文件没有主动读取入口, 后续规则也不再同步到其中。
- 当前 `SKILL.md` 已稳定承接默认八步流程, `principles.md` 承接原理解释。
- 继续保留失效副本会让分发内容包含不再维护的旧结构, 而决策记录和 Git 历史已经能够回放迁移原因与旧内容。

## 决策
- 采用: `skills/prompt-optimize/SKILL.md` 继续作为默认执行路径 owner, 保持压缩后的主流程。
- 采用: `skills/prompt-optimize/references/principles.md` 继续承接按需读取的原理和长期理由。
- 采用: 删除 `skills/prompt-optimize/references/archive/workflows.md` 和 `rewrite-rules.md`, 不再随 skill 分发迁移副本。
- 采用: 旧结构的形成和退出原因由决策关系及 Git 历史回放。
