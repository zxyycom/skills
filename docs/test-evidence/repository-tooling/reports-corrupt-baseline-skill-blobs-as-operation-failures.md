### Case SKILL-PACKAGE-HASH-005: 将损坏基线 skill blob 报告为操作失败
Entry:
- `scripts/lib/skill-package-hash.test.ts > reports corrupt baseline skill blobs as operation failures`
- `bun test --test-name-pattern="^reports corrupt baseline skill blobs as operation failures$" ./scripts/lib/skill-package-hash.test.ts`
Contract:
- 基线 skill 文件读取失败不得被解释为文件缺失或新 skill。
Proves:
- 损坏 Git blob 返回带受控读取操作、目标路径和 `command-failed` 原因类别的 `operation-failed`。
