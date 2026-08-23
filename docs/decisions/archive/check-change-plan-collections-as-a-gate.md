---
title: 把 Change 集合检查作为独立门禁
status: archived
alignment: aligned
createdAt: 2026-08-11T07:14:17Z
purpose: 让调用方一次判断一个 Change 根中的 active Change 是否全部有效，同时保留发现命令对无效成员的可见性。
background: 单目录 check 无法直接用于仓库门禁，而 list 即使逐项检查也必须在成员无效时继续成功，才能承担发现与修复入口。
decision: 使用独立 check-all 聚合现有单项检查；默认门禁 active Change，显式选择 archived 或全部集合，根级错误或任一成员无效时整体失败。
tags:
  - change-plan
relations: []
---

## 目的

- 让自动化和 agent 不必自行扫描 Change 目录、拼接单项结果和重新定义失败条件。
- 让发现与门禁保持不同成功语义：无效成员仍能被列出，同时集合检查在任一成员无效时可靠失败。

## 背景

- 单 Change `check` 接受显式目录并提供完整机械诊断，适合定位和修复一个目标。
- `list` 为展示状态而逐项运行同一 checker，但成员无效不表示目录发现失败；如果让它因此返回失败，调用方反而难以稳定发现待修复成员。
- 普通持续维护只需要门禁 active Change。Archived Change 是历史材料，后续结构规则可能演进，不应默认要求全部历史持续迁移。

## 决策

- 采用: 提供独立的 `check-all` 集合命令，复用 change root 的直接子目录发现和现有单 Change checker；不根据路径形态猜测单项或集合模式，也不复制校验规则。
- 采用: 集合检查默认覆盖 active Change；调用方可以显式只检查 archived，或检查 active 与 archived。Archived 审计不进入默认持续门禁。
- 采用: 根目录或目标生命周期目录错误、任一成员无效都会使集合检查失败；结果保留根级错误、逐项完整诊断和可由同一成员集合派生的汇总计数。
- 采用: `list` 继续在成员无效时成功并展示其状态，单目录 `check` 继续接收显式 Change 目录；集合门禁不改变两者的既有职责和退出语义。
