---
title: 随 Skill 保留固定上游快照与许可证
status: active
alignment: aligned
createdAt: 2026-08-11T03:27:00Z
purpose: 让 minimal-implementation 的行为提炼能够对照固定上游材料，并在分发副本时保留许可来源。
background: 仅引用可变上游不能稳定回放提炼依据，而把原始材料加入普通执行路径又会扩大上下文并混入非当前契约。
decision: 将固定版本的上游逐字材料及许可证随 skill 分发，仅在维护、审计提炼或更新固定版本时读取，普通执行不加载。
relations:
  - type: 拆分
    target: minimal-implementation/choose-smallest-correct-maintenance-surface.md
---

## 目的
- 为行为提炼和后续审计保留可重复对照的上游依据。
- 在复制和分发上游材料时保留许可证，并阻止原始流程成为普通运行的第二行为 owner。

## 背景
- 上游分支和文档会继续变化，只保存链接无法证明当前行为实际从哪个版本提炼。
- 逐字快照能够支持差异审计，但其原始术语、流程和假设不等同于当前 skill 契约。
- 上游作品随包复制时需要同时保存适用许可证；快照和法律文件的去留可以独立于核心最小实现行为演进。

## 决策
- 采用: 将用于当前行为提炼的上游材料固定到明确版本并以逐字快照随 `minimal-implementation` 分发，同时保留适用许可证。
- 采用: 普通最小实现选择和 complexity audit 不加载上游快照；只有维护本 skill、审计本次提炼、比较原始行为或更新固定版本时才读取。
- 采用: 上游快照只提供追溯证据，不成为当前行为契约；当前执行仍以 `SKILL.md` 及其当前 owner 为准。
- 采用: 更新快照时固定新的上游版本、保留适用许可证，并重新审计当前 skill 的触发、边界和行为提炼；具体来源与版本由当前分发事实 owner 表达。
