# 决策记录清单

本文件是 `docs/decisions/` 的导航 owner，负责列出影响面、状态速查和具体决策链接。记录门槛、文件命名、状态关系、正文结构和更新流程由 [decision-record-rules.md](decision-record-rules.md) 承接。

## 阅读方式

1. 先按“影响面”确定要查的长期责任边界。
2. 在“决策清单”中查看对应记录；文件名前缀中的状态表示当前有效性。
3. 非 `active` 决策的替代、修订或失效来源，以决策文件 `## 状态` 中的后续决策链接为准。

## 状态速查

每个决策文件名包含状态段：`YYMMDD-<status>-short-title.md`，例如 `260710-active-short-title.md`。状态只用于目录浏览时快速判断；具体关系以决策文件的 `## 状态` 为准。

状态值：

1. `active`：当前仍完整生效。
2. `amended`：仍有回放价值，但部分规则、命名或适用方式已被后续决策修订。
3. `superseded`：已被后续决策替代，不再作为当前规则执行。
4. `invalidated`：因后续发现冲突、前提错误或无效结论而不再作为依据。

## 影响面

一级目录使用影响面 ID。影响面 ID 是稳定责任边界，使用 kebab-case，不包含日期、阶段或一次性动作。

当前影响面：

1. `decision-records`：决策记录体系自身的目的、结构、命名、门槛、状态和维护方式。

后续按实际设置新增影响面。可能的影响面包括 `repository-layout`、`windows-host`、`distro-config`、`networking`、`storage-mounts`、`resource-limits`、`automation` 和 `backup-restore`；示例不代表必须预先创建目录。

## 决策清单

`decision-records`：

1. [active: 2026-07-10 - 采用可回放的决策记录流程](decision-records/260710-active-adopt-decision-record-workflow.md)
