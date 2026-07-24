---
title: 压缩 prompt-optimize 入口并归档迁移副本
status: archived
alignment: null
createdAt: 2026-07-18T11:43:07+08:00
purpose: 降低 prompt-optimize 的默认加载和判断成本，同时保留必要细节的可访问性。
background: "`skills/prompt-optimize/SKILL.md` 在承接默认执行路径后, 同时保留了过多细则展开, 使用时需要关注的点过多。"
decision: "`SKILL.md` 继续作为默认执行路径 owner, 但主执行流程只保留压缩后的八步判断链, 细节解释由 `principles.md` 和具体任务上下文承接。"
relations:
  - type: 修订
    target: prompt-optimize-references/260630-merge-prompt-optimize-core-flow-into-entry.md
---

## 目的
- 降低 prompt-optimize 的默认加载和判断成本，同时保留必要细节的可访问性。

## 背景
- `skills/prompt-optimize/SKILL.md` 在承接默认执行路径后, 同时保留了过多细则展开, 使用时需要关注的点过多。
- `workflows.md` 和 `rewrite-rules.md` 已不参与主动读取, 继续放在 `references/` 根目录会让维护者误以为它们仍是普通引用文件。

- 用户明确要求先尝试压缩入口, 且不要删除迁移保留文件, 而是移到 `references/archive/`。
- 入口仍需要保留默认执行路径, 不能退回到必须读取旧 `workflows.md` 或 `rewrite-rules.md` 才能完成主流程。

## 决策
- 采用: `SKILL.md` 继续作为默认执行路径 owner, 但主执行流程只保留压缩后的八步判断链, 细节解释由 `principles.md` 和具体任务上下文承接。
- 采用: `workflows.md` 和 `rewrite-rules.md` 移入 `skills/prompt-optimize/references/archive/`, 作为迁移前旧结构留存。
- 采用: `references/archive/` 只作为文件保留位置, 不写入入口主动引用清单。
- 不采用: 删除迁移副本。原因是用户要求保留, 且旧结构仍有回溯价值。
