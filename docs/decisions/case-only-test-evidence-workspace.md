---
title: 固定 Case-only 测试证据工作区协议
id: 260907-case-only-test-evidence-workspace
status: active
alignment: aligned
createdAt: 2026-09-07T10:02:46Z
purpose: 让固定测试证据根只保存 Case 源和派生索引，并把测试实体输入改为显式快照。
background: Topic 目录、固定实体输入和运行时兼容会把查询与项目采集耦合。
decision: 固定 Case-only 目录与显式快照引用边界，旧目录只由受控迁移入口转换。
tags:
  - test-evidence-review
relations:
  - type: 修订
    target: fix-test-evidence-workspace-contract
---

## 目的
- 让通用测试证据工具只从固定的 Case 源目录和派生索引读取证据声明，不从项目目录发现实体或执行采集。
- 让项目以显式、可核对的实体快照作为引用检查输入，而不把项目采集协议带入 skill 的正常读取路径。

## 背景
- 旧 topic 目录、固定实体文件和运行时双格式兼容会把人工 Case、查询索引和项目测试发现耦合在一起。
- Case 查询需要可独立重建的索引；实体快照只属于一次明确的引用检查输入，不能作为索引或常规查询前提。

## 决策
- 采用: 测试证据根固定为 `docs/test-evidence/`，只允许 `cases/` 中的直属 Case Markdown 与 `test-evidence-index.json`；CLI/API 仍只由 `--root` 或 `workspaceRoot` 选择工作区。
- 采用: 每个 Case 的身份来自首行 Case ID，文件使用 `cases/<小写-case-id>.md`；可选 tags 只用于筛选，不建立 topic 表、路径层级、别名或注册表。
- 采用: 核心引用检查只接收调用方显式提供的 schema v2 实体快照及独立 `expectedSource`；缺失、来源不符或 partial 快照阻断，不从固定路径、配置或项目回调发现输入。
- 采用: 旧 topic 目录只由显式迁移入口预演并受控写入转换；正常运行时拒绝旧布局，不保留自动双读或兼容回退。
- 不采用: 可配置账本根、固定实体输入、topic 布局或为旧格式保留运行时兼容路径。
