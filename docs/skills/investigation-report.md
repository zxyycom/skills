# Investigation Report

`investigation-report` 保存一轮调查在形成时的认识：为什么调查、检查了什么、得出了什么，以及依据和适用边界。后来者可以据此理解、复核并接续调查。

本页是人类的定位入口。Agent 从 [SKILL.md](../../skills/investigation-report/SKILL.md) 开始执行；报告格式和维护约束由[固定契约](../../skills/investigation-report/references/investigation-report-contract.md)承接。

## 什么值得沉淀

当前请求或生效项目规则明确要求记录或维护报告时使用。没有这类要求时，普通调查、排障和问答在当前任务中交付。

适用于各领域中值得独立保留的调查认识，包括仍有未知的阶段性结果。同轮补证、纠错和收敛完善原报告，独立新轮次另行成篇；具体边界见[固定契约](../../skills/investigation-report/references/investigation-report-contract.md#报告边界与有效演进)。

当前事实由代码、规范和配置等事实来源承接；长期方向、实施计划与测试义务由对应 owner 承接。调查可以为它们提供依据，但不自动产生采用或实施授权。

## 一份报告应说清什么

| 核心 | 要回答的问题 |
| --- | --- |
| 形成时背景 | 当时发生了什么，有哪些事实、假设、未知和约束？ |
| 调查目的 | 本轮具体要回答什么，准备支持什么判断？ |
| 调查范围与依据 | 实际检查了哪些对象，采用什么来源、方法、版本或时点，哪些未覆盖？ |
| 调查结果与边界 | 哪些是确认事实、推断、建议、实际动作和未知，结论适用于什么条件？ |

写法围绕本轮问题展开：解释关键依据与判断转折，区分事实、推断和未知。渐进探索可以在同一轮中逐步收窄问题，按取得新依据的实际时点完善认识。具体方法见 [写作指导](../../skills/investigation-report/SKILL.md#2-形成可独立复核的认识)。

## 报告、关系与资源

报告以稳定 Investigation ID 标识，tags 用于分类，直接前序关系表达认识演进，派生索引用于查找和追溯。所有正式报告保留在同一集合；当前口径由当前事实 owner 承接。

正文独立解释关键认识；资源按需补充现场与做法，以必要、Git 友好的纯文本为优先。日志和数据可简化，一次性分析代码、测试代码或查询可用于解释当时动作；材料的来源与处理方式须清楚。复现与重跑按任务另行要求，结论可信度仍取决于来源、方法和推理。

资源的保留范围、形式和维护边界见 [资源选择](../../skills/investigation-report/SKILL.md#3-选择随附资源)。

## 从哪里开始

需要新建时：起草 candidate → 完成正文与资源 → 审查和预检 → 授权范围内 publish → 全量检查与交付。一般内容与发布条件由 agent 自行判断，关键事实缺失、超出范围或明确要求人工决定时再询问。

- 查找正式报告：已知 ID 或唯一 name 用 `show`，按分类、时间或关系浏览用 `list`，按主题发现用 `search`，追溯演进用 `trace`。
- 起草、审阅与维护：[Skill 入口](../../skills/investigation-report/SKILL.md)负责流程与质量判断；[固定契约](../../skills/investigation-report/references/investigation-report-contract.md)负责格式、关系、资源和事务约束。
- 获取命令参数：本仓库使用 `bun run investigation-report -- help <command>`。
- 遇到工具、索引或写入异常：按[维护恢复](../../skills/investigation-report/references/maintenance-recovery.md)核对范围和恢复结果。
