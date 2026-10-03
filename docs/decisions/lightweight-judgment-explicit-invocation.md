---
title: Lightweight Judgment 采用显式调用策略
id: 261003-lightweight-judgment-explicit-invocation
status: active
alignment: aligned
createdAt: 2026-10-03T17:46:41Z
purpose: 保留按需轻量判断能力，避免普通语义任务隐式外包。
background: JEV 委托增加数据外发、费用及准备复核成本，是否值得调用取决于具体任务。
decision: 仅对 lightweight-judgment 关闭 Codex 隐式启用，保留显式调用与常规分发。
tags:
  - lightweight-judgment
  - skill-invocation
relations: []
---

## 目的

- 让 `lightweight-judgment` 作为用户主动选择的局部判断工具保留在常规 skill 分发中，而不是普通分类、筛选和评分任务的默认委托路径。

## 背景

- 适用 skill 为 `lightweight-judgment`，当前行为与分发路径为 `skills/lightweight-judgment/`。服务调用会外发材料并产生费用；准备请求、读取结果及复核也有成本，模型低单价本身不能证明一次委托值得执行。
- 本能力定位为按需显式调用。保留安装与发现入口、关闭隐式启用，能够让用户选择使用时机，同时复用现有配置、CLI 和更新方式。

## 决策

- 采用: 在 `skills/lightweight-judgment/agents/openai.yaml` 中设置 `policy.allow_implicit_invocation: false`，保留 Codex 的 `$lightweight-judgment` 显式调用；行为入口及项目概览同步说明仅在用户点名后使用。
- 该策略仅适用于此 skill；不改变其他 skills 的触发方式，不移出 `skills/`，不通过全局禁用或删减打包输入实现。配置的宿主语义以 [Codex 官方说明](https://learn.chatgpt.com/docs/build-skills#optional-metadata) 为依据。
- 显式选择只确定要使用的能力，后续外发范围、调用规模、费用及业务操作仍遵循当前授权；仓库中的分发配置不替代安装位置更新与宿主实际加载验证。
