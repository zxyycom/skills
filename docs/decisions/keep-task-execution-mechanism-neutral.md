---
title: 保持 task 协调的执行机制中立
status: active
alignment: aligned
createdAt: 2026-08-11T03:22:01Z
purpose: 让 task-graph 提供统一协调契约，由调用方独立选择执行者和执行方式。
background: 执行者的选择和配置随调用环境变化，把具体机制写进协调 owner 会使可选能力成为分发前提。
decision: Task-graph skill 与状态工具共同分发但不创建或审计执行者；所有执行方式使用同一领取、续租和收敛契约。
tags:
  - task-graph
relations:
  - type: 修订
    target: separate-task-coordination-from-execution-mechanism.md
---

## 目的

- 让不同执行者和协作方式都能消费同一组可恢复协调事实，而不改变 task-graph 的领域契约。
- 让 task-graph 的必要状态工具随 skill 可用，同时不把任何可选执行机制变成安装或分发前提。

## 背景

- 执行者的创建、配置、模型选择和结果审计取决于调用环境与当前授权，不是任务协调状态的一部分。
- Task graph 只需提供执行目标、完成提示、约束、关系、当前状态和 lease 边界，即可让不同执行方式安全参与同一协调流程。
- 如果 task-graph 依赖某个具体执行 skill 或 agent 类型，其分发和行为会被可选机制反向约束。

## 决策

- 采用: `task-graph` skill 与兑现其协调行为所需的专用状态工具属于同一分发单元；工具负责确定性状态和拓扑操作，skill 负责触发、判断、权限、交接与完成条件。
- 采用: 调用方选择实际执行者和执行方式；task-graph 不创建、配置、选择或审计执行者，具体机制也不进入 task-graph 的分发前提。
- 采用: 所有执行者从同一任务事实取得目标、完成提示、约束、关系、当前状态和 lease 边界，并遵守统一的 claim、renew、恢复与终态收敛契约。
- 采用: 执行者选择与 task 的协调状态彼此独立；排队、领取和 result 都不授予执行动作本身所需的文件、外部系统或不可逆操作权限。
- 不采用: 在 task-graph 中绑定特定 subagent、模型、协作 skill 或执行器配置。
