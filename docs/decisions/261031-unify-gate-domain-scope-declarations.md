---
title: 统一领域声明的检查输入与维护代码投影
id: 261031-unify-gate-domain-scope-declarations
status: active
alignment: aligned
createdAt: 2026-10-31T07:44:32Z
purpose: 让显式领域验证的检查选择和代码扫描共享范围来源，避免无关代码扫描与路径声明分叉。
background: 检查订阅已有领域输入，但指标仍全仓运行；混合共同输入与领域文件会扩大局部代码范围。
decision: 领域表区分文件范围与额外输入，检查沿用订阅，文件和函数指标使用所选领域维护代码投影。
tags:
  - project-tooling
  - responsibility-boundaries
  - validation-boundaries
  - vibe-gate
relations: []
---

## 目的

- 让领域的检查选择、完整输入证明与维护代码质量扫描共享可维护的范围来源，同时分别保留各自的证明责任。
- 使显式选择不扫描无关领域代码，又不因收窄扫描而隐去所选检查真正读取的共享依赖或削弱完整验收。

## 背景

- [显式本地验证范围](261027-prefer-explicit-local-gate-scopes.md)已经确立 quick、任务显式 scope 与完整兜底的分工；[工具变更与检查订阅](distinguish-tool-change-flags-from-check-subscriptions.md)已经分开能力输入、变更 flag 和 Check 验证责任。它们继续约束选择、成功前置、receipt 和发布快照，不需要因增加代码投影而归档。
- 领域输入同时包含领域自身文件、共同配置及实际依赖。如果直接把完整输入闭包当作代码范围，公共加载材料和构建辅助会使显式领域扫描无关代码；若另写指标路径表，又会让检查范围与代码范围各自演进。
- 默认基线中的类型、lint、format 与结构校验使纯文档任务承担完整代码验证成本。把这些命令移入相关领域后，仍需保留其完整实际 program/代码输入，而不是把进程选择误当作程序裁剪。
- [指标阻断判断](block-code-quality-metric-findings.md)已经选择 blocking、既有阈值和空 waiver。本判断只限定不同 Gate 模式下的材料选择，不降低选中材料的阻断政策，也不改变完整验收的代码覆盖。

## 决策

- 采用: 在 `scripts/lib/vibe-gate/impact-tools.ts` 以同一份 `gateToolScopes` 声明维护稳定领域 ID、领域文件 `files` 与额外检查依赖 `additionalInputs`。`gateToolInputs` 由这份声明形成完整输入投影；不另建手工维护的指标领域路径表。Check 继续订阅实际能力，成功依赖仍由原生 `dependsOn` 独立维护。
- 采用: 领域自身文件与检查输入闭包分责。`files` 拥有领域文件范围，`additionalInputs` 和共同输入保留真实传递读取；额外依赖、共享配置及成功前置带入的输入不自动成为显式代码扫描领域。不能为了减少扫描而漏掉 changed 的真实检查输入。
- 采用: selected 的文件指标和函数指标使用所选 `files` 在现有 `scripts/`、`tools/` JavaScript/TypeScript 维护代码上的投影。`files` 中以这两个维护目录起始的正 patterns 定义代码候选，其他 patterns 保留领域材料或生成副本。每个领域先独立应用包含与排除，再对所选集合取并集；一个领域的排除不能抵消另一个领域的包含。没有选中的维护代码不借由共享输入扩散进指标扫描。
- 采用: quick 仅保留环境、密钥、JSON、Schema、Markdown 链接与 Markdown 内容六项公共检查。代码领域选中时必跑文件/函数指标和既有 typecheck、lint、format:check 五项质量检查，后三个命令仍读取完整现有 TypeScript program 或维护代码集；validate 由 repository-validation 或 skill-validator 领域选中。重复检测保留既有 repository-code 订阅及完整维护代码范围，避免改变跨领域比较责任，不因任意代码领域自动启动或裁剪。
- 采用: changed、full、CI 和 release 保留现有完整原生材料范围，其他原生材料不随显式领域收窄。保留已有 Check ID、CLI scope ID、原生阈值、blocking、基础环境前置与成功前置。基础环境仍依现行环境 owner 检查 SCC；本判断不包含最小环境自举改造。
- 采用: 本判断与显式选择、能力订阅及指标阻断的既有判断独立共存。quick/selected 不采集全域指纹、不读写项目 receipt；changed 独占完整输入证明的复用与发布；full/CI/release 全执行，生成前置与同快照发布职责保持。领域声明的当前字段、接入和验收由[编写契约](../gate-check-authoring.md#领域范围与检查订阅)维护，精确范围由[原生政策](../gate-policy.md#原生材料范围与质量政策)承接。
