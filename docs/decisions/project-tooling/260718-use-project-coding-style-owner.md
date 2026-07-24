---
title: 采用项目级编码规范 owner
status: active
alignment: aligned
createdAt: 2026-07-18T16:23:28+08:00
purpose: 为脚本实现的归属、边界、类型、组织和风险验证提供单一长期 owner。
background: "`AGENTS.md` 已承接项目协作约定，`docs/tooling.md` 已承接脚本工具链，但实现代码的归属、边界、类型、组织和风险验证缺少独立 owner。"
decision: 使用 `docs/coding-style.md` 承接 `scripts/` 实现代码的通用质量规则，由 `AGENTS.md` 提供读取入口；行为契约和工具链细节继续留在各自 owner。
relations: []
---

## 目的
- 为脚本实现的归属、边界、类型、组织和风险验证提供单一长期 owner。

## 背景
- TypeScript 维护脚本已经覆盖校验、打包、生成和决策记录等不同职责，后续代码改动需要共享的实现质量判断。
- 把编码细则继续写入 `AGENTS.md` 会扩大项目协作入口，把它们写入 `docs/tooling.md` 又会混合实现质量与命令、依赖、生成和发布规则。

## 决策
- 采用: 使用 `docs/coding-style.md` 作为 `scripts/` 实现代码通用质量规则的唯一 owner，承接实现归属、边界处理、类型表达、代码组织和风险验证原则；`AGENTS.md` 只保留 owner 摘要和读取条件，各 skill 行为契约与 `docs/tooling.md` 的工具链细节保持原有归属。
