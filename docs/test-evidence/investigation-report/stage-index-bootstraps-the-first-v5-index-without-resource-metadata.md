### Case INVESTIGATION-STAGE-BOOTSTRAP-001: 首次暂存 v5 调查索引不写资源 Metadata

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index bootstraps the first v5 investigation index without resource metadata`
- `bun test --test-name-pattern="^stage-index bootstraps the first v5 investigation index without resource metadata$" ./tools/investigation-report/tests/run.ts`

Contract:
- revision 尚无调查索引时，合法的首次主题选择可创建 pending v5 索引；资源引用保留在主题 state，metadata 始终为空，领域文件不随索引进入 pending。

Proves:
- bundled API 为含二进制随附资源的首个主题创建仅含派生索引的 pending。
- pending 索引使用 definition version 5、空 metadata，并保留该主题的报告级资源引用。
