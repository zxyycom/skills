### Case TEST-EVIDENCE-LEDGER-SOURCE-DRIFT-001: 投影期间来源漂移不得返回或落盘
Entry:
- `tools/test-evidence/tests/ledger-index.test.ts > ledger operations reject entity and case drift before returning or writing projections`
- `bun test --test-name-pattern="^ledger operations reject entity and case drift before returning or writing projections$" ./tools/test-evidence/tests/run.ts`
Contract:
- 索引构建与写入必须在提交结果前复核实体与 Case revision。
Proves:
- 注入 Case revision 漂移会返回 source-changed，且不写入派生索引。
