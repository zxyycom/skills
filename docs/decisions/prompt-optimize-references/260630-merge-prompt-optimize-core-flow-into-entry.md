---
title: 将 prompt-optimize 核心流程合并回入口
status: archived
alignment: null
createdAt: 2026-06-30T17:17:43+08:00
purpose: 让 prompt-optimize 触发后直接获得默认流程，减少重复读取和职责分散。
background: "`workflows.md` 和 `rewrite-rules.md` 在实际使用中读取概率过高, 基本成为 `prompt-optimize` 的默认执行路径。"
decision: 由 `prompt-optimize` 的 `SKILL.md` 直接承接定位、出口、骨架、审计、owner、规则收敛、表达、冲突、交付和完成检查。
relations:
  - type: 替代
    target: prompt-optimize-references/260630-reorganize-prompt-optimize-rewrite-rules-as-pipeline.md
---

## 目的
- 让 prompt-optimize 触发后直接获得默认流程，减少重复读取和职责分散。

## 背景
- `workflows.md` 和 `rewrite-rules.md` 在实际使用中读取概率过高, 基本成为 `prompt-optimize` 的默认执行路径。
- 继续把它们作为按需引用, 会让入口文件低估真实执行复杂度, 也会在未完整读取引用时增加行为漂移风险。

- 本记录从 `prompt-optimize` 原单 skill 仓库迁入主仓库决策目录, 只解释 `prompt-optimize` 的引用结构演进。
- 该记录创建时主仓库通过 submodule 维护多个 skill 子仓库; 当前 `prompt-optimize` skill 本体位于 `skills/prompt-optimize/`。
- 入口文件应承接触发条件、主动引用策略、主执行流程、冲突处理、交付格式和完成检查。
- 大型迁移需要稳妥推进: 原拆分文件先作为迁移期保留副本留在引用目录, 文件开头说明保留原因和原作用, 稳定后再判断是否删除。
- 保留副本不再作为主动读取入口, 当前运行路径不再直接引用它们。
- 本决定替代此前将 `workflows.md` 和 `rewrite-rules.md` 作为主动 owner 的安排; [旧决策记录](260630-reorganize-prompt-optimize-rewrite-rules-as-pipeline.md) 继续保留, 用于回放上一阶段拆分的理由。

1. 先判断拆分收益: 如果引用文件只在低频、争议或特殊任务中使用, 保持拆分可以减少入口长度。
2. 再判断实际读取路径: `workflows.md` 和 `rewrite-rules.md` 已经覆盖生成、改写、审阅和具体判断, 缺失时会改变输出质量。
3. 因此把两者的主干合并为入口文件中的线性执行协议, 避免入口、工作流和改写规则三套相似流程并存。
4. 同时保留原文件作为迁移期副本, 便于回溯旧结构和降低一次性删除的风险。

## 决策
- 采用: 在 `prompt-optimize` 中, `SKILL.md` 直接承接定位目标、任务出口、文档骨架、行为审计、内容 owner、规则关系、负向描述、表达格式、沉淀判断、模式分流、冲突处理、交付格式和完成检查。
- 采用: 在 `prompt-optimize` 中, `principles.md` 和 `agent-tasks.md` 继续作为主动引用文件, 分别承接原理解释和子 agent 任务结构。
- 采用: 在 `prompt-optimize` 中, `workflows.md` 和 `rewrite-rules.md` 作为迁移期保留副本静默留存, 文件开头说明保留原因、原作用和当前状态。
- 不采用: 将两个文件原样拼接进入口。原因是原文与入口已有最小协议存在重叠, 原样拼接会制造重复流程和 owner 漂移。
