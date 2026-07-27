### Case DECISION-CONFIGURED-DIRECTORIES-001: 决策目录支持相对与绝对配置

Entry:
- `tools/decision-records/tests/configured-decision-directory.test.ts > configured decision directories support relative and absolute paths`
- `bun test --test-name-pattern="^configured decision directories support relative and absolute paths$" ./tools/decision-records/tests/run.ts`

Contract:
- 决策根目录配置必须正确解析 workspace 相对路径和显式绝对路径。

Proves:
- 两种配置都定位同一类决策制品且不改变身份语义。
