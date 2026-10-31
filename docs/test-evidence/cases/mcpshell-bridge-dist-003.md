### Case MCPSHELL-BRIDGE-DIST-003: generated Node initializer and runtime execute from an installed skill layout

Tests:
- `test:6d3e4af1161361c6d6e999321f97bd08e332c65d19dc1ef17ab9ffd9de9aadd1`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 从 `<agent-project>/skills/<skill>/scripts` 布局执行的 Node artifacts 必须自定位 env、完成初始化并运行 runtime。

Proves:
- generated initializer apply 成功；PATH 中隔离 ssh fixture 时 generated runtime shell 返回目标 stdout。
