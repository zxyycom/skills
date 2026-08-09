### Case INDEX-RUNTIME-STAGING-INDEX-001: 暂存前严格拒绝无效输入索引

Entry:
- `tools/index-runtime/tests/staging.test.ts > rejects invalid revision and workspace indexes before pending replacement`
- `bun test --test-name-pattern="^rejects invalid revision and workspace indexes before pending replacement$" ./tools/index-runtime/tests/run.ts`

Contract:
- revision 与工作区索引都必须作为 UTF-8 文本通过同一 definition 的完整严格解析，才能参与条目选择。

Proves:
- 非 UTF-8 revision 索引返回稳定的 `revision-index-invalid` 诊断。
- 非 UTF-8 或 definition identity 不匹配的工作区索引返回 `workspace-index-invalid`，且 pending 不变。
