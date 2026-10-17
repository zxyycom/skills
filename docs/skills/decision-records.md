# Decision Records

`decision-records` 保存会长期影响后续选择的判断：**采用什么方向、为什么采用、适用边界，以及如何演进**。它让后来者恢复取舍理由，并区分当前基线、已确认的未来方向与历史判断。

本页是人类的定位入口。Agent 从 [SKILL.md](../../skills/decision-records/SKILL.md)开始；代码、配置、规范与项目文档仍提供当前事实。

## 什么值得记录

当判断持续影响行为、责任边界、兼容性、风险处理或验收，且未来需要回放采用理由时，适合形成决策。最小对象是一条能整体独立修订、替代、归档和判断对齐的长期判断；普通事实、任务进度和执行结果由各自 owner 承接。

候选讨论、误述纠正和理由补足完善原记录。采用方向真实改变且前后都有独立回放价值时，形成自包含后继；多个可独立演进的方向应分别记录。演进关系及其摘要说明后继具体保留、改变或承接了什么。

## 怎样理解状态

| 状态 | 含义 |
| --- | --- |
| `candidate` | 尚未建立的候选，先完成内容与审核。 |
| `active` | 已建立且仍需在当前工作中恢复的判断。 |
| `archived` | 已退出当前依据的历史判断。 |

已建立记录的 `aligned` 表示完整方向已经成为当前事实并经核对，`unaligned` 表示已确认的未来方向；归档只保留最后核对状态。未来方向参与相关方案选择，但记录本身不产生实施任务或授权。状态和对齐的完整规则见[生命周期与对齐](../../skills/decision-records/references/decision-record-rules.md#生命周期与对齐)。

## 从哪里开始

- **查询、起草或维护决策**：[Skill 任务路由](../../skills/decision-records/SKILL.md#任务路由)区分只读、写作、操作与异常恢复；维护记录仍属于工具使用。
- **检查格式和判断边界**：[决策记录规则](../../skills/decision-records/references/decision-record-rules.md)承接身份、正文、生命周期与演进语义。
- **执行命令**：[CLI 操作契约](../../skills/decision-records/references/cli-operations.md)按操作解释前提、影响和结果，本仓库通过 `bun run decision-records -- help <command>` 取得参数。
- **修改 CLI、SDK 或测试实现**：[工具维护入口](../../tools/decision-records/README.md)承接实现约束和验证路径，不是普通决策维护的前置。
