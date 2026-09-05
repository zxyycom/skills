### Case DECISION-SEARCH-HELP-001: Decision search 帮助公开匹配模式与结构筛选

Entry:
- `tools/decision-records/tests/cli-args.test.ts > decision search help exposes full-text modes and structural filters`
- `bun test --test-name-pattern="^decision search help exposes full-text modes and structural filters$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision search 的帮助必须公开 content/metadata 范围、all、any、phrase 匹配模式、alignment、status、tag 结构化筛选，以及单个关系目标、方向和关系类型条件。

Proves:
- search 帮助列出 in、match、alignment、status、tag、related-to、direction 和 relation-type 选项。
- 帮助明确列出两种允许范围和三种允许的匹配模式。
