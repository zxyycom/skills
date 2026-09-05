### Case TEST-EVIDENCE-INDEX-PROJECTION-VALIDATION-001: 严格检查验证持久化源路径与 Topic Metadata

Entry:
- `tools/test-evidence/tests/catalog.test.ts > strict checks validate persisted source paths against topic metadata`
- `bun test --test-name-pattern="^strict checks validate persisted source paths against topic metadata$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- 严格 check 必须重新执行领域投影校验，确认持久化 `sourcePath` 的 topic 段属于 metadata。

Proves:
- 将该 entry 的 source path 改到未知 topic 后，严格验证返回阻断性 `state-index.*` 诊断。
