---
title: "确认延期方向并退出活动 Change"
formedAt: "2026-08-11T03:08:36Z"
question: "标准测试结果协议与阻断资格在没有实施授权时应由哪些长期载体承接？"
tags:
  - "test-evidence"
relations: []
---

## 形成时背景

仓库曾以 active draft Change 探索统一测试结果 JSON、Test ID、runner producer、test-evidence consumer、阻断资格和 Test → Case 派生。该 Change 后来明确标注为长期延期且不授权实施；长期方向已经由 `docs/decisions/archive/defer-standard-test-result-blocking.md` 承接。当前 Task Graph 另由 `task-000035` 负责真实多对多账本迁移，尚未选择测试结果协议或阻断资格实施。

本轮全仓决策与载体审计发现，继续把探索材料保存在 active Change 会同时复制长期决策、维持虚假的当前实施入口，并让维护者误以为历史 Schema 和任务清单仍可直接执行。原始材料包含真实的候选比较和重启依据，仍具有独立复核价值，因此不能只删除。

## 调查目的

确认该探索是否仍应作为活动 Change，恢复其中值得保留的认识与当前适用边界，并判断未来在什么条件下可以重新建立实施计划。本轮只整理知识载体和决策边界，不选择协议 Schema，不实现 runner producer、consumer、check、CI 或测试证据行为。

## 调查范围与依据

本轮完整审阅了原 Change 的 proposal、design、tasks，相关 active+unaligned 决策，`task-000026` 的已完成结果，以及 `task-000035` 的迁移目标。原始三个 artifact 以随附资源保留，供未来复核其形成时字段、方案比较、失败分类和迁移设想。

调查依据限于当前仓库事实与已保存历史材料；没有运行真实 runner 事件实验，没有验证历史候选 JSON Schema，也没有证明任何 producer/consumer 接口已经实现。历史材料中的测试数量、提交、字段名和执行顺序均是形成时输入，不是当前契约。

## 调查结果与边界

1. 活动 Change 不再成立。当前没有明确实施优先级、授权或已经选择的跨 owner 实施目标；长期延期方向本身不足以维持 draft stage。
2. 原记录包含两个能够独立演进的长期判断：runner 边缘的版本化结果协议，以及正式测试结果取得行为阻断资格的身份、关系与完整性门禁。它们应由 `task-000058` 通过闭合决策拆分分别承接，而不是继续共用一个 Change。
3. 当前尚未满足重新规划条件：真实 Test–Case 账本迁移仍由 `task-000035` 候选任务承接，仓库没有已经选定的逐 Test runner producer，也没有当前测试阻断实施授权。
4. 原 proposal、design 和 tasks 只作为形成时调查资源保存，不能作为当前 Schema、实施计划或验收标准直接执行。未来重启时必须重新核对测试身份 owner、真实 runner 事件、账本 revision、正式阻断面和授权范围。
5. 本轮将该主题从活动 Change 迁入 Investigation Report，没有改变测试、check、CI、Test Evidence 或 runner 行为。长期方向继续由 Decision Records 承接；只有方向被明确选入实施后才建立新的 Change。

## 随附资源

- [候选设计与取舍](./_resources/defer-standard-test-result-blocking/design.md)
- [探索 proposal](./_resources/defer-standard-test-result-blocking/proposal.md)
- [历史重启清单](./_resources/defer-standard-test-result-blocking/tasks.md)
