# 2026-07-06 - 将子代理任务说明移出 prompt-optimize

## 状态

- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为当前 `prompt-optimize` 引用范围和子代理任务 owner 的维护规则使用。

## 问题

- `prompt-optimize` 的 `agent-tasks.md` 曾负责 worker、explorer、并行 agent 和子 agent 任务结构。
- 新增 `subagent-orchestration` 后, 子代理任务派发、工作区边界、等待策略和结果审计已有独立 owner。
- 继续在 `prompt-optimize` 保留子代理任务引用, 会造成两个 skill 同时承接同一协作边界, 增加触发和维护噪音。

## 决定

- 采用: 删除 `skills/prompt-optimize/references/agent-tasks.md`, 由 `skills/subagent-orchestration/SKILL.md` 承接子代理编排和子任务派发规则。
- 采用: `skills/prompt-optimize/SKILL.md` 的主动引用只保留原理解释和整体审阅所需引用, 不再主动分流到子代理任务说明。
- 不采用: 在 `prompt-optimize` 中保留子代理任务说明作为备用参考。原因是该内容已有更稳定 owner, 备用副本会让后续规则分裂。
- 触发条件: 后续维护涉及子代理、worker、reviewer、parallel agent、委派任务、工作区边界或子代理输出格式时, 优先维护 `subagent-orchestration`。

## 影响

- `prompt-optimize` 更专注于 prompt、规则、任务、需求、模板和 agent 指令本身的结构优化。
- 子代理协作规则只在 `subagent-orchestration` 完整解释, `prompt-optimize` 不再重复维护子代理任务模板。
- 后续修改 prompt 类文本时, 若只是优化某段子代理任务文案, 仍可使用 `prompt-optimize`; 若要决定如何编排子代理, 使用 `subagent-orchestration`。

## 验证

- `skills/prompt-optimize/SKILL.md` 不再引用 `references/agent-tasks.md`。
- `skills/prompt-optimize/references/agent-tasks.md` 已删除。
- 主仓库校验应确认 Markdown 链接、skill frontmatter、package lock 和打包状态有效。
