### Case TEST-EVIDENCE-REVISION-PARITY-001: 完整与快速读取产生相同逐 Case Revision

Entry:
- `tools/test-evidence/tests/run.ts > full and fast source reads return the same per-case revision`
- `bun test --test-name-pattern="^full and fast source reads return the same per-case revision$" ./tools/test-evidence/tests/run.ts`

Contract:
- 完整快照与快速 revision 读取必须对同一合法 catalog 返回相同的 metadata 和逐 case revision record，并共同规范化 LF 与 CRLF。

Proves:
- 对正文包含 fenced 伪标题的默认 fixture，两条路径返回完全相同的 revision，完整读取只物化两个真实 case ID。
- 将一个 case 源从 LF 改为 CRLF 后，两条路径仍返回与初始值相同的 revision。
