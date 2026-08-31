### Case GATE-MARKDOWN-LINK-001: Markdown 链接校验阻断 finding 并对 unavailable fail closed

Entry:
- `scripts/vibe-check.test.ts > Markdown link validation blocks findings and fails closed when unavailable`
- `bun test --test-name-pattern="^Markdown link validation blocks findings and fails closed when unavailable$" ./scripts/vibe-check.test.ts`

Contract:
- Markdown 本地链接 finding 必须阻断 aggregate；输入不可用也不能被解释为成功。

Proves:
- 有效本地链接 fixture passed，改为缺失目标后 Check failed。
- 不存在的项目根使 Check unavailable，并由 aggregate fail closed。
