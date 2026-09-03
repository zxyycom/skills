### Case MCPSHELL-BRIDGE-FILE-006: workspace get reads a fixed physical source snapshot after its lexical parent swaps

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace get reads a fixed physical source snapshot after its lexical parent swaps`
- `bun test --test-name-pattern="^workspace get reads a fixed physical source snapshot after its lexical parent swaps$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- get 在验证 source parent 后必须在该 physical directory 内以 basename 建立 regular-file hard-link snapshot；后续 metadata 与传输不能重新解析 lexical source path，并在结束前复核 containment。

Proves:
- fixture 在 remote `wc` 时把 lexical parent symlink 换到 project 外同长度 secret；staging 接收原 physical source bytes，而不是外部 secret。
