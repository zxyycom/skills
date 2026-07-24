---
title: 归并为产品与架构判断
status: active
alignment: aligned
createdAt: 2026-07-20T15:59:38+08:00
purpose: 让 agent 通过一个工程判断流程决定事情是否该做、该做到什么程度, 以及应由谁在哪一层实现, 避免在相似能力之间路由。
background: 问题重构与产品架构思维共享局部优化风险、消费者、结果、边界、抽象和取舍, 并会产生相同工程动作, 无法形成稳定的独立触发与验收。
decision: 删除两个旧 skill, 新建独立分发的 `product-architecture-judgment`, 将问题重构作为内部动作, 统一使用产品价值与架构责任选择最小工程方案。
relations:
  - type: 归并
    target: problem-reframing-behavior/260720-keep-problem-reframing-self-contained.md
  - type: 归并
    target: product-architecture-thinking-behavior/260720-separate-framing-from-engineering-landing.md
---

## 目的
- 让 agent 在深入局部实现前, 同时判断当前事情的必要性、产品与开发者价值、合理完成程度和架构落点。
- 用一个可独立触发和验收的工程决策流程取代两个需要互相区分或交接的相似能力。
- 保留重新审视问题、校准产品结果和调整架构责任中的有效判断, 同时消除重复入口与分发成本。

## 背景
- `problem-reframing` 会从真实结果、必要性、边界和抽象层重新选择问题, 并可能保留、简化、改写、上移或放弃当前工作。
- `product-architecture-thinking` 会从消费者、产品结果、责任 owner、系统边界和抽象层重新选择技术动作, 并可能不做、简化、重定责任、提炼抽象或局部实现。
- 两者由相同的局部复杂度、结果缺失和错误层级触发, 读取高度重叠的证据, 最终动作也无法由是否改变目标结果稳定区分。
- 产品与架构视角是工程任务中重新审视问题和解法的判断维度, 不是需要独立安装、触发和交接的第二套流程。

## 决策
- 采用: 删除 `skills/problem-reframing/` 与 `skills/product-architecture-thinking/` 两个分发单元, 新建 `skills/product-architecture-judgment/` 作为唯一行为 owner。
- 采用: 将新 skill 定位为流程与决策型能力, 在需求分析、方案设计、实现、排障、重构、审查和工程决策中判断事情是否该做、该做到什么程度, 以及应由谁在哪一层实现。
- 采用: 将目标结果、当前问题或需求和已有解法明确分开; 问题重构作为形成工程候选的内部动作, 不再保留独立身份或交接。
- 采用: 产品方向判断用户、调用方、运营者和开发者收益、必要性、影响程度与成功边界; 架构方向判断责任 owner、事实源、边界、数据流、抽象稳定性和演进成本。
- 采用: 统一从不做、简化、改写、重定责任、提炼抽象和局部实现中选择有证据支持且直接兑现目标的最小动作, 不因放眼大局默认扩大范围。
- 采用: 新 skill 作为独立分发单元自包含运行; 项目入口和人类说明只保留新身份, 旧决策记录继续作为历史回放依据。
