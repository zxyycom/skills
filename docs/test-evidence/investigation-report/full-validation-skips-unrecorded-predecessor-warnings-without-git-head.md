### Case INVESTIGATION-RELATION-GIT-HEAD-002: 无基线时跳过前序提示并报告不可用的历史检查

Entry:

- `tools/investigation-report/tests/parsing-directory.test.ts > full validation skips unrecorded predecessor warnings without Git HEAD`
- `bun test --test-name-pattern="^full validation skips unrecorded predecessor warnings without Git HEAD$" ./tools/investigation-report/tests/run.ts`

Contract:

- 非 Git 或尚未形成 HEAD 时，默认全量检查跳过尚未进入 Git HEAD 的直接前序关系提示；Git HEAD 检查本身失败时，必须给出 `history-check-unavailable` warning，不能伪装为已跳过。

Proves:

- 非 Git 和尚未形成 HEAD 时不产生前序 warning。
- 损坏的 HEAD 保持 check 成功，但返回包含 `history-check-unavailable` 的可行动 warning，且版本控制 detail 只保留一次，不再嵌入原始 Error message。
