### Case MCPSHELL-BRIDGE-DIST-003: generated Node initializer and runtime execute from an installed skill layout

Tests:
- `test:d60c4b7ef2459cecf9d929258c9c643c03c0e8983df73db3dd78aeef30975a5d`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 从 `<agent-project>/skills/<skill>/scripts` 布局执行的 Node artifacts 必须自定位 env、完成初始化并运行 runtime。

Proves:
- generated initializer apply 成功；PATH 中隔离 ssh fixture 时 generated runtime shell 返回目标 stdout。
