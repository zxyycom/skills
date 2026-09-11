### Case TASK-GRAPH-CLI-HELP-CATALOG-001: 每个规范命令都有可恢复的结构化 help

Tests:
- `test:60840e0eee31f6f601a8b0d729e8e6d03ebc93db9834ad607b4d3cfeec14962b`

Tags:
- `task-graph`

Contract:
- Root help 中的每个 command 都能独立查询结构化 command help，并显式报告是否需要 native runtime；特殊多值参数和 apply input metadata 保持显式。

Proves:
- 24 个 command path 各自返回匹配的 command 名。
- Index stage 的 usage 明确要求为每个 ID 重复 --task，且 `requiresMutationRuntime` 为 false；它与 task remove 的多值 --task、task create 的多值 --acceptance 及 apply stdin/file JSON 输入契约逐字段成立。
