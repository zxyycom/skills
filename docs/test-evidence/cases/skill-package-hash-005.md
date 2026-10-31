### Case SKILL-PACKAGE-HASH-005: 将损坏基线 skill blob 报告为操作失败

Tests:
- `test:f32870c74c88b1d796a914623c6ecbadb24e381777242e6659a0d45f3ad23ab1`

Tags:
- `repository-tooling`

Contract:
- 基线 skill 文件读取失败不得被解释为文件缺失或新 skill。

Proves:
- 损坏 Git blob 返回带受控读取操作、目标路径和 `command-failed` 原因类别的 `operation-failed`。
