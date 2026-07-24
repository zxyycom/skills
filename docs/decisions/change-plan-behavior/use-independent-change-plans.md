---
title: 使用独立 Change Plan 承接临时变更计划
status: active
alignment: aligned
createdAt: 2026-07-23T03:24:48Z
purpose: 让项目在不采用完整 specification 生命周期时也能保存可审阅、可交接并带实施门禁的 change 计划。
background: 稳定文档和长期决策已有各自 owner，而 OpenSpec 的 proposal、design 与 tasks 仍提供有价值的 change 级规划结构。
decision: 新增独立 `change-plan`，以三文件临时计划和只读结构检查器承接规划，不拥有稳定事实、长期决策或实施许可。
relations: []
---

## 目的
- 让项目能够独立选择轻量的 change 规划能力，在不引入 capability、delta spec、主 spec 合并或专属归档系统时，仍保存目标、范围、当前设计、实施门禁、任务和验证安排。
- 让计划的机械结构、内容审阅和实施许可保持可区分，避免 agent 把文件齐全或检查通过误作方案已经批准。

## 背景
- 项目稳定文档已经可以承接当前行为、接口、边界和验证语义，长期决策记录可以解释跨 change 持续有效的方向与理由。
- OpenSpec 的真实使用表明 proposal、design 和 tasks 对跨会话规划、局部判断、执行顺序和验证交接仍有价值，但这些价值不必依赖 specification 与 capability 生命周期。
- 若直接把计划内容并入稳定文档或长期决策，会混淆当前事实、长期理由和一次 change 的临时实施上下文；若只保留对话计划，又无法稳定交接和机械检查。

## 决策
- 采用: 新增独立分发的 `skills/change-plan/`，为一个明确 change 创建、更新或审阅 `proposal.md`、`design.md` 和 `tasks.md`；三个 artifact 分别承接目标与范围、当前 change 的设计上下文，以及 Readiness、Implementation 和 Verification 任务。
- 采用: Change plan 是临时实施上下文。项目文档继续拥有稳定事实和行为；项目已有长期决策 owner 时，跨 change 持续有效的理由与方向进入该 owner；`change-plan` 不把其他 skill 作为未声明运行前提。
- 采用: 计划建立和结构检查通过不表示获得实施许可。`tasks.md` 必须先于实施保存 Readiness 门禁，阻塞开放问题、缺少必要授权或未完成准备审计时不得把计划报告为可执行。
- 采用: `tools/change-plan/` 拥有检查器源码、声明和测试，`scripts/build/change-plan.ts` 负责生成随 skill 分发的自包含 Node CLI；检查器只读验证目录、固定文件、Markdown 章节与任务语法，不判断事实、方案、决策归位、验证充分性或授权。
- 采用: 现有 OpenSpec skills 保持独立分发和既有行为；新增 `change-plan` 不自动迁移、替代或删除已有 OpenSpec change。
