### Case DECISION-CLI-ARCHIVE-HELP-001: Archive 帮助承诺保留最后对齐状态
Entry:
- `tools/decision-records/tests/cli-args.test.ts > archive help promises to preserve the last alignment`
- `bun test --test-name-pattern="^archive help promises to preserve the last alignment$" ./tools/decision-records/tests/run.ts`
Contract:
- Archive 的公开帮助必须说明归档保留决策最后一次 alignment。
Proves:
- `archive --help` 成功并包含 preserving their last alignment。
