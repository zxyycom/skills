### Case SKILL-PACKAGE-HASH-005: 将损坏基线 skill blob 报告为操作失败

Tests:
- `test:6af8382d97cf4fa1045ca7f3ff3f9f90ce69ceb22a1149e5d5de1c9b800adaa3`

Tags:
- `repository-tooling`

Contract:
- 基线 skill 文件读取失败不得被解释为文件缺失或新 skill。

Proves:
- 损坏 Git blob 返回带受控读取操作、目标路径和 `command-failed` 原因类别的 `operation-failed`。
