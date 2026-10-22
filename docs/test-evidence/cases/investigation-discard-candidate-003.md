### Case INVESTIGATION-DISCARD-CANDIDATE-003: formal discard protects candidate resource references

Tests:
- `test:e8232e1bf891ea7bab412047cf35dd73b52511d7fe93154ea0d21dea2fb70b10`

Tags:
- `investigation-report`

Contract:
- 正式 `discard` 不建立、删除或索引 candidate，但删除正式 owner resource 前必须保护 candidate 的共享引用。

Proves:
- authoring candidate 引用正式 owner resource 时，正式 `discard --delete-owned-resources` 被拒绝且资源字节保持不变。
- 将 candidate ID 传给正式 `discard` 只得到“formal report 不存在”的零写入结果，candidate 不会被该命令删除。
