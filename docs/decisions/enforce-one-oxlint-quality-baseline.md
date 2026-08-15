---
title: 以受校验的统一基线约束 Oxlint 配置
status: active
alignment: aligned
createdAt: 2026-08-15T12:05:52Z
purpose: 防止 Oxlint 配置绕过检查或降低项目已经选择的质量基线。
background: 局部注释规则不能阻止路径忽略、配置继承、规则关闭或基线选项降级在运行前削弱检查。
decision: 将 Oxlint 配置作为受校验的统一基线；配置行为变化必须同步规范、前置校验和测试，局部例外继续使用带理由的单行抑制。
tags:
  - project-tooling
relations:
  - type: 修订
    target: use-local-reasoned-oxlint-exceptions.md
---

## 目的
- 让 `lint` 与 `lint:fix` 每次执行同一套已确认的质量基线，不能被配置级绕过静默削弱。
- 让基线调整具有明确 owner、同步范围和回归证据，同时保留前序决策建立的局部例外路径。

## 背景
- 文件、路径、继承或规则集合级配置能够在 Oxlint 执行前跳过源码或关闭诊断；降低 correctness、type-aware、未使用抑制检查或所需插件也会削弱当前基线。
- 仅要求例外使用紧邻单行注释，不能约束这些配置级入口。
- 配置、前置校验与测试若各自独立演进，维护者无法确认命令实际执行的规则仍与编码规范一致。

## 决策
- 采用: 将根目录 `.oxlintrc.json` 作为受校验的统一项目基线；`lint` 与 `lint:fix` 在启动 Oxlint 前同时验证官方 schema 和项目基线策略。
- 采用: 拒绝路径忽略、配置继承、文件级覆盖、规则关闭及其他未批准配置，也拒绝降低 correctness、type-aware、未使用抑制检查、所需插件和已批准规则配置。
- 采用: 改变 lint 基线行为时，先更新 `docs/coding-style.md` 的权威规则，再同步配置、前置校验和测试；配置不承接局部例外。
- 采用: 前序决策建立的紧邻、带理由单行抑制继续作为唯一局部例外路径。
