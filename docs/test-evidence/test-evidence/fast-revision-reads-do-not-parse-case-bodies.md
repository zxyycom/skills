### Case TEST-EVIDENCE-REVISION-FAST-PARSE-001: 快速 Revision 读取不解析 Case Body

Entry:
- `tools/test-evidence/tests/run.ts > fast revision reads do not parse case bodies`
- `bun test --test-name-pattern="^fast revision reads do not parse case bodies$" ./tools/test-evidence/tests/run.ts`

Contract:
- 快速新鲜度读取必须直接从已读取来源取得 case ID 并计算指纹，不得调用完整 case body parser。

Proves:
- 带合法唯一标题但正文结构无效的 Markdown 仍可产生逐 case 指纹，而完整快照读取稳定拒绝该正文。
