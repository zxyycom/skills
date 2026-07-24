---
title: 让子代理 skill 描述聚焦触发条件
status: active
alignment: aligned
createdAt: 2026-07-18T12:27:40+08:00
purpose: 让 skill 的触发入口清楚表达何时调用，避免执行细节稀释触发信号。
background: "`description` 同时枚举触发场景和历史、所有权、等待、审计等执行规则，削弱触发信号并重复正文。"
decision: "`description` 只说明子代理编排定位和触发条件；用户显式要求或任务适合委派时加载，执行规则留在正文。"
relations: []
---

## 目的
- 让 skill 的触发入口清楚表达何时调用，避免执行细节稀释触发信号。

## 背景
- Skill frontmatter 的 `description` 是系统决定是否加载 skill 的主要入口, 应优先帮助判断当前请求是否匹配。
- 历史传递、写入所有权、依赖排序、等待策略和结果审计只有在 skill 已经触发后才影响执行, 把这些细节放进入口会增加常驻上下文并重复正文。
- 当前 skill 同时支持用户显式点名子代理和 agent 根据任务特征主动委派, 两类触发都需要在入口中保留。

## 决策
- 采用: `skills/subagent-orchestration/SKILL.md` 的 `description` 先用一句话说明它是复杂任务中的子代理编排指南, 再完整表达何时加载。
- 采用: 保留两类触发条件: 用户明确要求使用子代理、worker、reviewer、parallel agent 或委派代理; 以及任务耗时长、影响面广或上下文负担重且适合拆分, 或需要实现与审查分离、并行调查、主线程只负责编排和结果审计。
- 采用: 历史范围、权限、写入所有权、依赖、等待和结果审计等执行规则继续由 skill 正文承接。
- 不采用: 在 `description` 中枚举 skill 的具体执行能力。原因是这些内容不服务触发判断, 并会与正文形成重复 owner。
