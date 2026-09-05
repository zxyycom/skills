### Case DECISION-SEARCH-HELP-001: Decision search 帮助公开匹配模式与结构筛选

Entry:
- `tools/decision-records/tests/cli-args.test.ts > decision search help exposes full-text modes and structural filters`
- `bun test --test-name-pattern="^decision search help exposes full-text modes and structural filters$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision search 的帮助必须公开 all、any、phrase 匹配模式以及 alignment、status、tag 结构化筛选。

Proves:
- search 帮助列出 match、alignment、status 和 tag 选项。
- 帮助明确列出三种允许的匹配模式。
