### Case TEST-EVIDENCE-INDEX-SYNC-001: 索引同步写入有效可检索快照
Entry:
- `tools/test-evidence/tests/catalog.test.ts > index synchronization writes a valid searchable snapshot`
- `bun test --test-name-pattern="^index synchronization writes a valid searchable snapshot$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 写入同步必须从 catalog 生成当前有效的派生索引。
Proves:
- 同步返回 written，随后目录和索引校验无诊断。
