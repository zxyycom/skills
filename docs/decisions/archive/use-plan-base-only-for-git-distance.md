---
title: 让 Plan 基线只承担 Git 距离定位
status: archived
alignment: aligned
createdAt: 2026-08-11T06:09:13Z
purpose: 让 Plan 阶段与三个 artifacts 能在同一提交中自包含保存，同时保留命令运行时已有的 Git 距离基线。
background: 把 baseCommit 同时解释为历史基线与 artifact 内容快照，会迫使 artifacts 和阶段 metadata 分两次提交，也无法形成自包含 Plan 提交。
decision: plan 只把命令运行时已有的 HEAD 记录为 Git 距离基线，不比较 artifacts 与该提交的内容；未来若需要内容一致性证明，应建立独立机制而不改变 baseCommit 的职责。
tags:
  - change-plan
relations: []
---

## 目的

- 让完整 `proposal.md`、`design.md`、`tasks.md` 和 Plan 阶段 metadata 可以作为同一个版本控制提交保存。
- 保留 `baseCommit` 对最后一次成功运行 `plan` 时 `HEAD` 的表达，使既有 Git 距离与机械搁置判断仍有稳定起点。

## 背景

- `plan` 在写入阶段 metadata 前只能取得当前已有的 `HEAD`。如果三个 artifacts 必须与该提交内容一致，操作者就必须先提交 artifacts，再运行 `plan`，随后为 metadata 再创建一个提交。
- 包含 Plan metadata 的提交 hash 只有在提交形成后才能得到，不能写回该提交自身。用 `baseCommit` 同时承担历史定位和 artifact 内容指纹，会形成职责冲突而不是原子的一致性证明。
- 本决策没有引入独立的 artifact 内容一致性机制；结构门禁、Readiness 和人工语义审阅继续承担进入 Plan 前的内容检查。

## 决策

- 采用：`plan` 要求仓库已有 `HEAD`，把命令运行时的该提交记录为 `baseCommit`，但不要求三个 artifacts 已经提交或与该提交内容一致。
- 采用：Plan assessment 只检查基线能否用于当前 first-parent Git 距离，并据此返回 `current`、`shelve-candidate` 或基线不可用；工作树、index 和后续提交中的 artifact 内容差异不触发 `plan-review-required`。
- 采用：操作者可以在运行 `plan` 后，把三个 artifacts 与 `.change-plan.json` 放入同一个提交。
- 采用：如果后续需要机械证明 artifact 内容一致性，应另行选择不依赖自引用提交 hash 的机制，并通过独立决策与契约引入；不得重新把 `baseCommit` 解释为 artifact 内容快照。
