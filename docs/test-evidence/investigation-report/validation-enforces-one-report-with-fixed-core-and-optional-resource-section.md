### Case INVESTIGATION-REPORT-STRUCTURE-001: validation enforces one report with fixed core and optional resource section

Entry:

- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces one report with fixed core and optional resource section`
- `bun test --test-name-pattern="^validation enforces one report with fixed core and optional resource section$" ./tools/investigation-report/tests/run.ts`

Contract:

- 每个 Markdown 是一份报告，前四个 H2 固定；可选随附资源在第五位，附加语义 H2 仅可位于核心或资源之后，fence 内标题不参与结构识别。

Proves:

- 旧无 frontmatter 内容被拒；核心后或资源后附加章节以及 fenced 标题通过；插入核心、资源之前或非规范资源标题各被拒绝。
