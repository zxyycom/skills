### Case TEST-EVIDENCE-LEDGER-REVISION-FRAMING-001: Ledger revision 区分排版与语义变化
Entry:
- `tools/test-evidence/tests/ledger-index.test.ts > ledger revisions normalize formatting and line endings while tracking semantic changes`
- `bun test --test-name-pattern="^ledger revisions normalize formatting and line endings while tracking semantic changes$" ./tools/test-evidence/tests/run.ts`
Contract:
- Revision framing 必须忽略实体 JSON 排版与 Case 换行差异，同时跟踪 Case 路径和语义。
Proves:
- 非语义改写保持 revision，移动单个 Case 只改变其 entry revision。
