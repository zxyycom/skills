### Case TEST-EVIDENCE-LEDGER-FILE-IDENTITY-001: Ledger 来源与索引不得共享文件身份
Entry:
- `tools/test-evidence/tests/ledger-source.test.ts > ledger source files reject filesystem identity collisions`
- `bun test --test-name-pattern="^ledger source files reject filesystem identity collisions$" ./tools/test-evidence/tests/run.ts`
Contract:
- 权威实体来源、Case 来源与派生索引必须保持不同的文件系统身份。
Proves:
- 索引与实体、索引与 Case、两个 Case、实体与 Case 的各类硬链接都会以对应 identity conflict 诊断被拒绝。
