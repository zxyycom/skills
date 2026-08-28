### Case INVESTIGATION-SOURCE-REVISION-001: source revisions fingerprint report Markdown and strict empty metadata only

Entry:
- `tools/investigation-report/tests/index-query.test.ts > source revisions fingerprint report Markdown and strict empty metadata only`
- `bun test --test-name-pattern="^source revisions fingerprint report Markdown and strict empty metadata only$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告索引来源 revision 指纹化报告 Markdown 与严格空 metadata。

Proves:
- 已建立索引携带非空 sourceRevision。
