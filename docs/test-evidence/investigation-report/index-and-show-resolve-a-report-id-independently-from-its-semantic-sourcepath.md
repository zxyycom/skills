### Case INVESTIGATION-QUERY-SOURCE-PATH-001: index and show resolve a report id independently from its semantic sourcePath

Entry:
- `tools/investigation-report/tests/index-query.test.ts > index and show resolve a report ID independently from its semantic sourcePath`
- `bun test --test-name-pattern="^index and show resolve a report ID independently from its semantic sourcePath$" ./tools/investigation-report/tests/run.ts`

Contract:
- 正式 Investigation ID 由 frontmatter 声明，索引以该 ID 为 key 保存独立 sourcePath；`show` 必须通过新鲜索引定位语义 filename 后回读同一 ID。

Proves:
- basename 为 `semantic-finding.md` 且 frontmatter ID 为 `stable-report` 的正式 Markdown 可同步为唯一的 `stable-report` entry。
- 该 entry 投影 `semantic-finding.md` sourcePath，`show stable-report` 返回仍声明同一纯 ID 的 Markdown。
- 同 ID 改用 `renamed-finding.md` 后旧索引的 sourcePath 不再可供 `show` 解析；同步重建只更新该 entry 的 sourcePath。
