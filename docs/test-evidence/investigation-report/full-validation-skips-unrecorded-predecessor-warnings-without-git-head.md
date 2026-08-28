### Case INVESTIGATION-RELATION-GIT-HEAD-002: 无可用 Git HEAD 时全量检查跳过前序提示

Entry:

- `tools/investigation-report/tests/parsing-directory.test.ts > full validation skips unrecorded predecessor warnings without Git HEAD`
- `bun test --test-name-pattern="^full validation skips unrecorded predecessor warnings without Git HEAD$" ./tools/investigation-report/tests/run.ts`

Contract:

- 不存在可用 Git HEAD 基线时，默认全量检查跳过尚未进入 Git HEAD 的直接前序关系提示。

Proves:

- 非 Git、尚未形成 HEAD 及 HEAD 不可读或无效的 Git 工作区中，直接前序关系均不产生 error 或 warning。
