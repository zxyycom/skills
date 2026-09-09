### Case GATE-FUNCTION-ANALYZER-001: 函数指标使用随包分析器

Tests:
- `test:c5e29360f8f94d86444705f635b36dbda351b49f6e33d0e593311c8d5b172d5c`

Tags:
- `repository-tooling`

Contract:
- 生产 `function-metrics` Check 必须使用 Vibe 0.0.2 随包分析器，不得保留外部 scanner 配置或 Lizard 运行前提。

Proves:
- 生产 Check 的完整 options 不含 `scanner` 字段。
- 清空 PATH 后，filesystem fixture 仍由函数指标分析并形成 passed outcome。
