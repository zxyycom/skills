---
title: 以命令参数或临时文件传递提交信息
status: active
alignment: aligned
createdAt: 2026-08-11T03:26:55Z
purpose: 让提交信息通过可直接审计且兼容受控命令执行的方式传给 Git。
background: 默认从标准输入传递消息会引入额外 shell 和权限通道，而大多数标题与多行正文可以由 Git 原生命令参数完整表达。
decision: 优先用重复的 git commit -m 参数传递标题和正文，仅在参数不能可靠表达时使用临时文件和 -F，不默认使用标准输入。
relations:
  - type: 拆分
    target: git-commit-organizer/260702-refine-commit-granularity-types-and-command.md
---

## 目的
- 让提交创建命令保持直接、可审计，并减少标准输入和复杂 shell 传递带来的失败面。
- 在保留多行正文能力的同时，只在确有需要时引入临时消息文件。

## 背景
- Git 的重复 `-m` 参数能够分别承接标题和正文，正文参数本身也可以保留多行 bullet。
- 通过标准输入调用 `git commit -F -` 会增加命令执行通道，在部分权限或命令控制环境中更容易被拒绝。
- 极端复杂的多行内容仍可能无法由当前命令接口可靠传递，需要保留文件路径作为受控回退。

## 决策
- 采用: 默认使用 `git commit -m "type：标题" -m "正文"`，通过独立参数传递标题和正文。
- 采用: 正文包含多条 bullet 时在正文参数中保留换行，不因多行本身切换传递机制。
- 采用: 只有当前命令接口无法可靠表达完整消息时，才创建临时提交信息文件并使用 `git commit -F <file>`。
- 不采用: 不把标准输入作为提交信息的默认传递路径。
