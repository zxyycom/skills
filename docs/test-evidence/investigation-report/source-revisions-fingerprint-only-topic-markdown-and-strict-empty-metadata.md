### Case INVESTIGATION-SOURCE-REVISION-001: 来源 Revision 仅指纹主题 Markdown 与严格空 Metadata

Entry:
- `tools/investigation-report/tests/index-query.test.ts > source revisions fingerprint only topic Markdown and strict empty metadata`
- `bun test --test-name-pattern="^source revisions fingerprint only topic Markdown and strict empty metadata$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查完整 snapshot 与快速读取共享仅由主题 Markdown 派生的结构化 revision；metadata 保持严格空对象，资源池不参与来源指纹。

Proves:
- 完整与快速 revision 相同，且来源输入顺序不会影响 revision。
- 改变一份主题 Markdown 只改变对应 entry 指纹，metadata 不变。
