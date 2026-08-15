---
title: 在前置检查收敛后运行 skill 打包
status: active
alignment: aligned
createdAt: 2026-08-11T04:03:05Z
purpose: 让一次检查命令只在本次所选前置门禁全部通过后生成 skill 制品。
background: 打包不是 profile 前置任务，与检查并发或在失败后执行会产生未经本次门禁证明的制品。
decision: 等待所选前置检查收敛，全通过时运行一次打包，否则跳过，并产出对应步骤结果。
tags:
  - project-tooling
relations:
  - type: 修订
    target: gate-packaging-on-selected-checks.md
---

## 目的

- 让 `bun run check` 生成的 skill 制品建立在本次所选前置检查全部通过的状态上。
- 让检查集合收敛与打包之间只有一个明确的进入条件和步骤结果。

## 背景

- `pack:skills` 生成交付制品，但不证明类型、行为、生成漂移或仓库结构已经通过所选门禁。
- Quick 与 full 选择的前置检查集合不同，打包都必须等待本次实际选择的集合完全收敛。
- 报告器需要消费打包步骤结果，但结果的展示、摘要和最终退出映射属于报告责任。

## 决策

- 采用: `pack:skills` 不属于 quick 或 full 前置检查集合，而是检查计划中的后续独立步骤。
- 采用: 打包步骤等待本次全部已选前置检查完成后再判定，不与这些检查并发。
- 采用: 任一已选前置检查失败时不运行打包，并产出 `skipped` 的打包步骤结果。
- 采用: 全部已选前置检查通过时恰好运行一次 `pack:skills`，并按命令结果产出 `passed` 或 `failed` 的打包步骤结果。
- 采用: 打包步骤结果交给统一报告责任消费；本记录不定义其显示格式、摘要字段或最终退出码。
