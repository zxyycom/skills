### Case INVESTIGATION-REPORT-STRUCTURE-001: validation enforces one report with fixed core and optional resource section

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces one report with fixed core and optional resource section`
- `bun test --test-name-pattern="^validation enforces one report with fixed core and optional resource section$" ./tools/investigation-report/tests/run.ts`

Contract:
- 每个 Markdown 只保存一份报告，并使用固定核心与可选随附资源章节。

Proves:
- 旧式内容因缺少报告 frontmatter 被拒绝。
