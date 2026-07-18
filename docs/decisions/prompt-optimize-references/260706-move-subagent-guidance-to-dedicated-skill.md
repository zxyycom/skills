# 2026-07-06 - 将子代理任务说明移出 prompt-optimize

## 索引摘要
- 目的: 让 prompt-optimize 聚焦结构化文本优化，并为子代理编排建立独立 owner。
- 背景: `prompt-optimize` 的 `agent-tasks.md` 曾负责 worker、explorer、并行 agent 和子 agent 任务结构。
- 决策: 删除 `skills/prompt-optimize/references/agent-tasks.md`, 由 `skills/subagent-orchestration/SKILL.md` 承接子代理编排和子任务派发规则。

## 目的
- 让 prompt-optimize 聚焦结构化文本优化，并为子代理编排建立独立 owner。

## 背景
- `prompt-optimize` 的 `agent-tasks.md` 曾负责 worker、explorer、并行 agent 和子 agent 任务结构。
- 新增 `subagent-orchestration` 后, 子代理任务派发、工作区边界、等待策略和结果审计已有独立 owner。
- 继续在 `prompt-optimize` 保留子代理任务引用, 会造成两个 skill 同时承接同一协作边界, 增加触发和维护噪音。

## 决策
- 采用: 删除 `skills/prompt-optimize/references/agent-tasks.md`, 由 `skills/subagent-orchestration/SKILL.md` 承接子代理编排和子任务派发规则。
- 采用: `skills/prompt-optimize/SKILL.md` 的主动引用只保留原理解释和整体审阅所需引用, 不再主动分流到子代理任务说明。
- 不采用: 在 `prompt-optimize` 中保留子代理任务说明作为备用参考。原因是该内容已有更稳定 owner, 备用副本会让后续规则分裂。

## 关系
- 修订: [将 prompt-optimize 核心流程合并回入口](260630-merge-prompt-optimize-core-flow-into-entry.md)
