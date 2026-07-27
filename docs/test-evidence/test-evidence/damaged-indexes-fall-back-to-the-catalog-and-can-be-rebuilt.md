### Case TEST-EVIDENCE-DAMAGED-INDEX-001: 损坏索引可回退并重建
Entry:
- `tools/test-evidence/tests/run.ts > damaged indexes fall back to the catalog and can be rebuilt`
- `bun test --test-name-pattern="^damaged indexes fall back to the catalog and can be rebuilt$" ./tools/test-evidence/tests/run.ts`
Contract:
- JSON 损坏但可恢复的索引不得阻断 catalog 查询，并应允许重建。
Proves:
- 查询返回当前 case 与非阻断诊断，写入同步恢复有效索引。
