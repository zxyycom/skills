### Case TEST-EVIDENCE-INDEX-PROJECTION-VALIDATION-001: 严格检查交叉验证持久化源路径与 Topic Key

Entry:
- `tools/test-evidence/tests/run.ts > strict checks cross-validate persisted source paths and topic keys`
- `bun test --test-name-pattern="^strict checks cross-validate persisted source paths and topic keys$" ./tools/test-evidence/tests/run.ts`

Contract:
- 严格 check 必须重新执行领域投影校验，确认持久化 `sourcePath` 的 topic 段属于 metadata，且与对应 `keys.topic` 表示同一 topic。

Proves:
- 将 access entry 的 topic key 改成 `sessions` 后，严格验证返回阻断性 `state-index.*` 诊断。
- 将该 entry 的 source path 改到未知 topic 后，严格验证返回阻断性 `state-index.*` 诊断。
