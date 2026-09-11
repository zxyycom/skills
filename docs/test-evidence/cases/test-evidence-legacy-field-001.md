### Case TEST-EVIDENCE-LEGACY-FIELD-001: Case 语法拒绝旧 Entry 字段

Tests:
- `test:79b5e9f8287834b2dd16b4f90d58ca6e911c2ec60b7422ea49c9be509f253c62`

Tags:
- `test-evidence`

Contract:
- 固定 Case 字段顺序不接受旧 `Entry:` 字段。

Proves:
- 含旧 `Entry:` 的 Case 在 `cases/legacy-entry.md` 产生 `case.section-invalid`。
