### Case DECISION-FAST-REVISION-001: 快速来源 revision 跟踪无效 Markdown 与来源路径

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > source revisions fingerprint invalid Markdown and sourcePath without parsing it`
- `bun test --test-name-pattern="^source\ revisions\ fingerprint\ invalid\ Markdown\ and\ sourcePath\ without\ parsing\ it$" ./tools/decision-records/tests/run.ts`

Contract:
- 快速 revision 可以对原始 Markdown 取指纹而不解析其合法性，并必须将 `sourcePath` 纳入身份。

Proves:
- 相同无效正文从根目录移动到 archive 后得到不同 entry revision。
