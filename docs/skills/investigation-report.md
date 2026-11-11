# Investigation Report

`investigation-report` 保存一轮调查在形成时的认识：为什么调查、检查了什么、得出了什么，以及依据和适用边界。后来者可以据此理解、复核并接续调查。

本页是人类的定位入口。Agent 从 [SKILL.md](../../skills/investigation-report/SKILL.md)开始，按当前任务选择所需材料。

## 什么值得沉淀

当前请求或生效项目规则明确要求记录或维护报告时使用；其他调查在当前任务中交付。报告适用于各领域，包括仍有未知的阶段性认识。

先恢复已有报告：同轮补证、纠错与收敛完善原报告，需要独立复核的新问题或新条件另行成篇。历史报告保存形成时认识，当前事实仍由代码、规范、配置等事实来源承接；调查为长期方向或实施提供依据，不自动产生采用或实施授权。

## 一份报告提供什么

| 内容 | 读者能恢复的信息 |
| --- | --- |
| 形成时背景 | 当时的事实、假设、未知与约束。 |
| 调查目的 | 本轮问题与准备支持的判断。 |
| 调查范围与依据 | 实际检查对象、来源、方法、版本或时点，以及未覆盖部分。 |
| 调查结果与边界 | 事实、推断、建议、实际动作与未知，以及结论适用条件。 |

正文独立解释关键认识，资源只承接正文仍需依赖的必要材料。稳定 ID 连接报告身份，tags 支持主题发现，直接前序关系表达认识演进，索引支持查找和追溯。复现与重跑按任务另行要求。

## 用本仓库理解资源取舍

通用方法见[资源选择与示例](../../skills/investigation-report/references/resource-selection.md)。以下实例按正文依赖选择保留位置与形式：能概括的关键依据归正文，需逐项核对、追溯或保留原话的材料精简后随附。

| 调查对象 | 正文依赖 | 保留位置与形式 |
| --- | --- | --- |
| [对象读取反例](../investigations/investigation-phase-facts-and-streamed-content.md)、[入口矩阵测量](../investigations/record-tools-entry-matrix-10k.md)及[查询普查](../investigations/261108-record-cli-native-complexity-survey.md) | 输入条件、方法、比较结果、反例与未知 | 正文概括承接，删除完整日志、逐次 stdout、逐文件清单及运行脚本。 |
| [图片协议取证](../investigations/openrouter-decision-live-protocols.md) | 合成图构造、legend 对象与节点关系、实际响应及精度边界 | 正文保留构造说明与响应要点，替代独立 PNG 和重复 Base64。 |
| [92 条历史对齐召回](../investigations/recall-historical-decision-alignment.md) | 各对象为何恢复为相应值 | 资源逐项保留恢复值、历史定位、区分性依据及推断限制。 |
| [Laya 来源清单](../investigations/_resources/260920-laya-decision-model-evidence/source-inventory.md)及[原生库候选定位](../investigations/_resources/261107-rust-record-library-replacement-survey/findings.json) | 正文未列齐的准确来源、问题定位及必要验证边界 | 资源保留最短定位材料，结论与建议由正文承接。 |
| [讨论原话与批注节选](../investigations/_resources/preserve-redacted-conversations-in-two-derived-forms/discussion-evidence-excerpts.md) | 用户真实纠正的目标句、原话与先后关系 | 资源保留带原回合、消息序号和批注索引的必要原话节选，删除工具过程和重复助手总结。 |

## 从哪里开始

- **查询、创建或维护报告**：[Skill 任务路由](../../skills/investigation-report/SKILL.md#任务路由)区分只读、写作、操作与异常恢复；维护报告仍属于工具使用。
- **检查报告格式和语义边界**：[固定契约](../../skills/investigation-report/references/investigation-report-contract.md)承接身份、正文、关系与资源规则。
- **执行命令**：[CLI 操作契约](../../skills/investigation-report/references/cli-operations.md)按操作解释前提、影响和结果，本仓库通过 `bun run investigation-report -- help <command>` 取得参数。
- **修改 CLI、SDK 或测试实现**：[工具维护入口](../../tools/investigation-report/README.md)承接实现约束和验证路径，不是普通报告维护的前置。
