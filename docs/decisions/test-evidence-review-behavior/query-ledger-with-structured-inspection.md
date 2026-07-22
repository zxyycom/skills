---
status: archived
alignment: null
createdAt: 2026-07-21T01:51:47Z
---

# 为测试账本提供可恢复查询与结构化诊断

## 索引摘要
- 目的: 让 agent 在严格校验之外直接恢复 case、入口映射和 review trigger，并稳定消费机器诊断。
- 背景: CLI 只有严格 check，成功结果只给汇总，普通错误仍是字符串，语义审查需要重复解析账本和源码。
- 决策: 保留严格 check，新增非阻断 list/show、可导入 inspection 和带版本的结构化 diagnostics。

## 目的
- 让日常测试审查能够先定位相关 case、文字契约、源码入口和人工检查状态，再按需展开完整内容。
- 让 CLI 与包内模块提供稳定、可分类并带位置的机器结果，不要求调用方解析人类错误字符串。
- 保持严格校验和恢复查询的完成语义分离，使局部损坏不遮蔽仍可恢复的证据，也不被误报为完整通过。

## 背景
- `test-evidence` 只有 `check`；校验成功时只返回计数，相关 case、main/derived/exempt 映射和 `Review:` 动作仍要由 agent 重新读取 Markdown 与源码恢复。
- 既有 JSON 的 `errors` 和 `warnings` 是自由字符串，调用方难以稳定区分配置、账本、发现、映射、Git 和人工检查问题，也缺少输出版本用于兼容演进。
- `decision-records` 已证明严格检查与可恢复查询可以共享同一底层扫描，同时用 warning 限定查询完整性。

## 决策
- 采用: `check` 继续执行严格校验；新增 `list` 和 `show` 恢复查询。配置有效且账本可读取时，无关条目存在诊断不阻断可恢复结果，查询必须披露 `incomplete` 和完整 diagnostics。
- 采用: `list` 支持按状态、验证方式和 trigger 筛选；`show` 要求唯一 case ID，并展开文字字段、源码映射、最近人工检查基线和当前 trigger。
- 采用: 严格报告和查询结果使用显式 `schemaVersion`；diagnostic 保存稳定 code、category、severity、message 和可用的位置或 case ID，同时保留 `errors`、`warnings` 兼容字段。
- 采用: 包内模块新增 `inspectTestEvidence`，返回 case、发现入口和严格报告组成的恢复视图；`validateTestEvidence` 和 `runTestEvidenceCli` 保持既有职责。
- 不采用: 让查询成功替代严格 `check`，或在查询期间自动修复账本、源码 marker 和人工检查状态。
