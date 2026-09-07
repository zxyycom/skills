### Case GATE-LIZARD-VERSION-001: 函数指标只接受精确 Lizard 版本

Tests:
- `test:2300487dcc159822057c39c298810ea11bb6993778a095d9bdb88a5b7a100a5f`

Tags:
- `repository-tooling`

Contract:
- Vibe 的函数指标必须通过项目窄 wrapper 只接受 PATH `lizard --version` 的精确 `1.23.0` 输出；版本失配不得被解释为可扫描的 Lizard，即使其能产生有效 CSV。

Proves:
- 真实配置的 `function-metrics` 使用 `scripts/lib/vibe-lizard.js`；精确 `1.23.0` 的 fake Lizard 收到 Vibe 原样传递的 `--csv` 扫描参数并使 Check passed。
- 返回 `1.23.1` 且本可产生有效 CSV 的 fake Lizard 使 `function-metrics` unavailable、full aggregate failed，既不调用 `pack:skills`，也不扫描或写入隔离的本次包制品。
