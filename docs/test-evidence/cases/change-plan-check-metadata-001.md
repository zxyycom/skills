### Case CHANGE-PLAN-CHECK-METADATA-001: 检查只接受规范 Active Metadata

Tests:
- `test:a9464328c401c2d8a1238bda66c4ea9cd74d9858559128486572ee00e808d609`

Tags:
- `change-plan`

Contract:
- Active Change 只通过规范 metadata 恢复 Draft 或 Plan 身份与 Git 基线。

Proves:
- null-base Plan、`implementation`、`shelved` 与含未知字段的 Draft 都得到 `invalid-metadata`，其 stage、metadata 与距离为空。
- 缺失 active metadata 得到缺失文件诊断。
