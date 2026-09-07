### Case TEST-EVIDENCE-LEGACY-FIELD-001: Case 语法拒绝旧 Entry 字段

Tests:
- `test:e111094bc27bf65ea450edddb7a89e28075fff24d63dda5fd52b0a9e7a23e806`

Tags:
- `test-evidence`

Contract:
- 固定 Case 字段顺序不接受旧 `Entry:` 字段。

Proves:
- 含旧 `Entry:` 的 Case 在 `cases/legacy-entry.md` 产生 `case.section-invalid`。
