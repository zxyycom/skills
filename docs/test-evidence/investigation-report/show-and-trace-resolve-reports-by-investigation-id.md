### Case INVESTIGATION-SNAPSHOT-SOURCE-MEMBERSHIP-001: show and trace resolve reports by investigation id

Entry:
- `tools/investigation-report/tests/index-query.test.ts > show and trace resolve reports by investigation id`
- `bun test --test-name-pattern="^show and trace resolve reports by investigation id$" ./tools/investigation-report/tests/run.ts`

Contract:
- `show` 与 `trace` 都以 Investigation ID 直接定位报告及其关系子图。

Proves:
- show 返回指定报告，successor trace 返回起点和后继。
