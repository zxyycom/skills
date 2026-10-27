---
title: 以统一生成结果作为 Gate 分发消费前置
id: 261020-unify-gate-generated-artifact-prerequisite
status: archived
alignment: aligned
createdAt: 2026-10-20T07:38:35Z
purpose: 让所有分发消费者只在唯一完整生成检查通过后运行，并保留领域定位能力。
background: 统一生成入口已调用各领域相同适配器，重复 Gate 生成节点增加运行与依赖维护面。
decision: Gate 只保留统一生成 provider，由原生 dependsOn 阻断不可信消费，领域检查和同步继续作为人工入口。
tags:
  - dependency-boundary-design
  - project-tooling
  - responsibility-boundaries
relations:
  - type: 修订
    target: declare-generated-artifact-prerequisites-for-vibe-consumers
    summary: 保留制品信任边界，将独立领域前置归并为完整统一检查并交给原生成功依赖
---

## 目的

- 让消费当前分发制品的 Check 只在生成一致性可信时启动，失败可归因到生成或消费的直接 owner。
- 用最小 Gate provider 表达完整生成义务，保留领域命令的人工修复与定位能力。

## 背景

- 前序按领域声明独立生成 Check，并由 consumer wrapper 读取前置终态；它建立了真实的制品信任边界。
- 统一 `check:skill-updaters` 已遍历全部 skill 并调用同一领域适配器，覆盖领域源码、入口、manifest/lock 和受管附属物。再在 Gate 重复执行独立领域生成入口，不增加产品义务。
- 原生 `dependsOn` 已表达成功前置并阻断未通过 provider 的 consumer，普通 consumer 无须重复判定状态。合并 provider 会扩大共同阻断范围，因此仍需领域直接命令承接定位。

## 决策

- 采用: Gate 中仅 `script:check:skill-updaters` 承接完整生成一致性检查；需要当前分发制品的语义或包脚本 consumer 直接依赖它。原生 Vibe 只在 provider passed 后启动 consumer，失败或 unavailable 时不启动，不重复实现状态守卫。
- 采用: 统一检查继续调用各领域现有同源适配器，不减损生成文件、manifest/lock、retired paths 与附属物检查。各领域 `check:*`、`sync:*` 和产品回归入口仍作为人工定位、同步与独立验证命令保留。
- 采用: provider 的项目输入证明覆盖完整统一输入；consumer 需要执行时，Vibe 将同一 invocation 的 provider 带入并实际执行，跨运行 receipt 不能充当成功前置。
- 采用: 接受统一生成失败时全部分发 consumer 共同阻断，以 artifact 路径和领域命令定位直接责任。这是制品信任边界，不改变 consumer 的稳定证明身份，也不以合并本身推断性能收益。
- 采用: 生成 adapter 覆盖发生变化时验证统一入口与领域义务仍等价；仅有独立产品契约或新增输入责任时才增加 Gate 结果。release 版本授权和打包仍由同快照交付 DAG 独立承担。
