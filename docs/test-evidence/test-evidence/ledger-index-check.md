### Case TEST-EVIDENCE-LEDGER-INDEX-CHECK-001: 严格检查阻断陈旧索引并允许重建
Entry:
- `tools/test-evidence/tests/ledger-index.test.ts > ledger checks block stale indexes and write sync rebuilds them`
- `bun test --test-name-pattern="^ledger checks block stale indexes and write sync rebuilds them$" ./tools/test-evidence/tests/run.ts`
Contract:
- 严格校验必须把陈旧派生索引视为阻断问题；写入同步必须从当前实体索引与 Case Markdown 重建一致投影。
Proves:
- Case 变化后 check 报 stale，显式 write 重建后 check 无诊断。
