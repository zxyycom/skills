### Case SKILL-PACKAGE-HASH-005: 将损坏基线 skill blob 报告为操作失败

Tests:
- `test:cba975edf0f13a2ead5e3c5dd497fe01836c0bb41fc72935bfbb16f6256e28e9`

Tags:
- `repository-tooling`

Contract:
- 基线 skill 文件读取失败不得被解释为文件缺失或新 skill。

Proves:
- 损坏 Git blob 返回带受控读取操作、目标路径和 `command-failed` 原因类别的 `operation-failed`。
