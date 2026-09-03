### Case MCPSHELL-BRIDGE-FILE-003: workspace put binds its final commit to the verified parent during a symlink swap

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace put binds its final commit to the verified parent during a symlink swap`
- `bun test --test-name-pattern="^workspace put binds its final commit to the verified parent during a symlink swap$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- put 在验证 destination parent 的 physical path 后，temporary 与最终 basename commit 必须都绑定到该已验证目录，不能被随后替换的 lexical symlink 重定向到 project root 外。

Proves:
- fixture 在 remote temporary 出现后把 project 内 symlink 换到 project 外目录；传输仍只写入原已验证 parent，外部目录没有 destination。
