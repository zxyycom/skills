---
title: 以工具变更 flag 和 Check 订阅表达 Gate 影响范围
id: 261020-distinguish-tool-change-flags-from-check-subscriptions
status: active
alignment: aligned
createdAt: 2026-10-20T15:26:07Z
purpose: 让工具输入变化与检查验证责任分别维护，可靠减少无关领域回归。
background: 领域级输入闭包让单一搜索输出变化触发无关暂存与生命周期矩阵，按检查私有 flag 难以表达共享影响。
decision: 小工具拥有完整输入和变更 flag，Check 显式订阅，原生条件负责选择，成功证明仍按 Check 保存。
tags:
  - dependency-boundary-design
  - project-tooling
  - responsibility-boundaries
  - vibe-gate
relations: []
---

## 目的

- 让源码能力的变更范围与 Check 的验证责任分别可维护，相关改动覆盖完整，无关契约可以复用已有成功证明。
- 保持一个权威运行结论，由原生机制处理选择、成功依赖、智能调度与结算。

## 背景

- 同一领域包含查询、历史判断、暂存、维护和分发等不同责任。领域级输入集合方便声明，但会把局部输出变更扩散到无关事务矩阵。
- 每个 Check 独有的启用 flag 能表示一次选择结果，却不能直接表达多个 Check 共享的工具能力。支持文件或入口的无关静态导入也会扩大真实加载闭包，单改 flag 名称不能解除这种耦合。
- [原生执行与完整输入证明](archive/separate-quick-gate-from-complete-validation.md)继续约束执行和成功事实。本判断独立细化工具输入与 Check 订阅的归属，不改变其质量、保守执行或最终发布事务。

## 决策

- 采用: 按现有独立源码职责和不同消费者识别小工具能力。能力表维护 ID 与完整输入 patterns，变更 flag 由 ID 派生；Check 在自身声明中显式订阅相关能力，使用原生条件组合。输入证明版本由全局契约与逐 Check 版本承载；身份和粒度按责任划分。
- 采用: 共享源码及生成副本按真实消费者传播，共同配置和无法可靠分类的输入保持保守。先整理实际支持文件、命令接线与验证职责，再收窄输入；尚存在的真实加载边不因某个分支未调用而被忽略。
- 采用: 成功事实仍由每个 Check 的完整输入指纹和最近成功 receipt 承担，同条 receipt 保存订阅能力指纹。完整指纹与全部订阅能力指纹精确匹配才可形成复用候选；能力变化形成共享 flag，不建立另一份工具成功缓存。共享 flag 带入的订阅者与依赖带入的 provider 如实执行、核验并记录；仅在最终 Run 成功、全部执行项通过且起止输入一致时原子发布证明。
- 采用: 完整 Definition、环境前置、原生材料结算、CI/cold 全执行及发布快照事务保持。当前能力集合、订阅和编写步骤由[项目工具链](../tooling.md)与[Gate 接入约定](../gate-check-authoring.md)维护。
