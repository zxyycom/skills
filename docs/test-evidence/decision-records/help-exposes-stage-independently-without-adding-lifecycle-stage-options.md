### Case DECISION-STAGE-CLI-001: CLI 独立公开 Stage 且不扩展生命周期选项

Entry:
- `tools/decision-records/tests/stage.test.ts > help exposes stage independently without adding lifecycle stage options`
- `bun test --test-name-pattern="^help exposes stage independently without adding lifecycle stage options$" ./tools/decision-records/tests/stage.test.ts`

Contract:
- 指定决策进入 pending 使用独立 `stage <decision-path...>` 命令，生命周期命令保持 filesystem 责任且不提供 `--stage`。

Proves:
- 顶层 CLI 帮助列出接受一个或多个显式路径的 `stage` 命令。
- `activate`、`evolve`、`archive`、`mark-aligned` 和 `discard` 的帮助均不包含 `--stage`。
