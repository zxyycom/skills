### Case MCPSHELL-BRIDGE-DIST-001: generated bridge modules import without configuration side effects

Entry:
- `tools/mcpshell-workspace-bridge/tests/generated.test.ts > generated bridge modules import without configuration side effects`
- `bun test --test-name-pattern="^generated bridge modules import without configuration side effects$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 分发 `.mjs` 可被 Node import，不读 env、不执行 CLI 且不产生写入副作用。

Proves:
- initializer 与 runtime module 都在独立 Node import 进程中以 status 0 结束。
