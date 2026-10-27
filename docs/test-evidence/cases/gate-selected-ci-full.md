### Case GATE-SELECTED-CI-FULL-001: CI 不被显式选组缩窄

Tests:
- `test:63799e6458099e20143f17fbf1c490bdb5ff12aa53f6b9ad37f727360064c4ee`

Tags:
- `repository-tooling`

Contract:
- CI 接收合法 selected 请求后仍执行完整 base；显式能力 flag 与 selectionScopes 不得削弱完整验收。

Proves:
- 请求 gate-tests 时准备器看到 full 且无 selectionScopes，Definition 无 activeToolIds 或 selectionScopes，run controls 无能力 flags。
- 实际原生调度执行完整 66 项 base，仍调用准备和发布入口各一次，三个 release-only 项不执行。
