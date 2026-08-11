---
title: 等待真实恢复需要后再设计 Task 终态纠正
status: active
alignment: aligned
createdAt: 2026-08-10T15:13:23Z
purpose: 在没有可复核误终态实例时保持终态事实与下游协调可信，不为理论完整性增加通用纠正能力。
background: 当前真实场景分别由后继 task 和语义 result 版本锚点解决，尚未出现必须撤销 succeeded 或 cancelled 才能恢复协调的案例。
decision: 当前不实现 correct、reopen 或新的 task 演进协议，维持现有终态封闭规则；只有出现后继或修复 task 无法处理的真实错误终态时才重新探索最小纠正机制。
relations:
  - type: 拆分
    target: task-graph/anchor-semantic-task-results-in-index-history.md
---

## 目的

- 保持 `succeeded` 和 `cancelled` 作为可信的当前协调事实，不在缺少现实恢复压力时扩大 task-graph mutation 面。
- 区分“原任务正确完成后新增需求”和“原任务终态事实本身错误”，避免把普通产品演进误作终态纠正需求。
- 为未来重新评估保留明确触发条件，同时不把已完成的探索误作当前路线图或实施承诺。

## 背景

- 当前 task-graph 已允许修改未终态 task；running task 由 lease owner 先收敛，failed task 通过 `retry` 返回 idle，`succeeded` 和 `cancelled` 则保持封闭。
- 已观察到的完成后新增需求可以创建独立后继 task，用稳定 reference 表达来源，并只在真实完成顺序成立时增加普通 dependency。该路径不需要重开原任务，也不需要新增 successor、supersedes 或 evolution relation。
- 已观察到的 result 提交 SHA 漂移由语义 result 与 task index Git 版本锚点解决，不需要原位修改 succeeded result，也不构成错误成功事实。
- `changes/establish-task-correction-and-successor-evolution/` 已探索显式 `correct`、纠正证据和上下游门禁，但当前没有可复核的错误 `succeeded` 或 `cancelled` 实例证明这组额外协议、Schema、CLI、SDK、文档和测试维护面必要。

## 决策

### 权威边界

- 采用：本记录只承接“当前是否探索终态纠正”以及“何时允许重新评估”的长期判断，不拥有 Change 阶段或 task-graph 实际行为。
- 采用：Change 阶段从其 `.change-plan.json` 读取，task-graph 实际行为从 `skills/task-graph/SKILL.md`、`docs/skills/task-graph.md` 和 `tools/task-graph/src/` 读取；shelved Change 只提供历史调查输入，不能覆盖这些 owner。

### 当前边界

- 采用：当前不实现 `correct`、`reopen`、通用 amend、任意 state patch 或新的 task 演进协议；现有 runtime、Schema、skill 行为和终态封闭规则保持不变。
- 采用：原任务正确完成后出现新目标、约束或产品方向时创建独立 task。稳定 reference 只表达来源，dependency 只表达真实调度顺序；原 task 的 phase、result 和版本锚点保持不变。
- 采用：未终态修正、running lease 收敛、failed retry 和 result/version anchor 继续由现有 owner 处理，不用终态纠正机制替代。
- 采用：已形成的终态纠正 Change 进入 `shelved`，只作为未来调查输入保留，不是 current plan、待执行任务或已经确认的产品契约；恢复时必须按当时事实重新计划。

### 重新评估条件

- 只有同时满足以下条件时，才重新探索最小终态纠正机制：
  1. 出现可复核案例，证明某个 `succeeded` 或 `cancelled` 在写入当时就是错误事实，而不是后来新增需求。
  2. 创建后继或修复 task 不能恢复正确协调，因为旧终态仍会错误满足下游门禁或冒充当前结果。
  3. 必须保留原 task 身份，并有明确 owner 和授权承担旧结果撤销、上下游收敛与审计责任。
- 重新评估时从现实 task 图、依赖消费者和恢复义务重新确定最小契约；不自动沿用 shelved Change 中的 `correct` 命令、paused 目标状态、evidence 字段或门禁细节。

### 不采用

- 不采用：为了 mutation 对称性、理论完整性或尚未发生的误操作预先实施终态纠正。
- 不采用：删除探索历史或静默改写已成功 task 来制造“从未计划过”的表象。
