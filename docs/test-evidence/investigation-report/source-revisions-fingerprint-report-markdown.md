### Case INVESTIGATION-SOURCE-REVISION-001: source revisions fingerprint report Markdown

Entry:

- `tools/investigation-report/tests/index-query.test.ts > source revisions fingerprint report Markdown`
- `bun test --test-name-pattern="^source revisions fingerprint report Markdown$" ./tools/investigation-report/tests/run.ts`

Contract:

- source revision 指纹化报告 Markdown；重新同步后产生新 revision。

Proves:

- 改写报告 Markdown 后当前 index 变为过期；公共 synchronize 成功重建并更新 revision。
