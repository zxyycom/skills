### Case MCPSHELL-BRIDGE-DIST-003: generated Node initializer and runtime execute from an installed skill layout

Entry:
- `tools/mcpshell-workspace-bridge/tests/generated.test.ts > generated Node initializer and runtime execute from an installed skill layout`
- `bun test --test-name-pattern="^generated Node initializer and runtime execute from an installed skill layout$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 从 `<agent-project>/skills/<skill>/scripts` 布局执行的 Node artifacts 必须自定位 env、完成初始化并运行 runtime。

Proves:
- generated initializer apply 成功；PATH 中隔离 ssh fixture 时 generated runtime shell 返回目标 stdout。
