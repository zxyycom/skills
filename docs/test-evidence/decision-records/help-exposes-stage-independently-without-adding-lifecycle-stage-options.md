### Case DECISION-STAGE-CLI-001: CLI 独立公开 Stage 且不扩展生命周期选项

Entry:
- `tools/decision-records/tests/stage.test.ts > help exposes stage independently without adding lifecycle stage options`
- `bun test --test-name-pattern="^help exposes stage independently without adding lifecycle stage options$" ./tools/decision-records/tests/run.ts`

Contract:
- stage 是独立命令，生命周期命令不应接受 --stage。

Proves:
- 根帮助包含 stage，生命周期子命令帮助均不含 --stage。
