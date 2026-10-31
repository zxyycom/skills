### Case DECISION-RENAME-HISTORY-001: 已记录 Decision 需要 rename 专属确认

Tests:
- `test:22914a00b0fe5f520566cfa409510577bb9254e4c51378cfa668d2230c65acd0`

Tags:
- `decision-records`

Contract:
- 进入 Git HEAD 的 Decision identity 仅可由 `--rename-recorded-decision` 明确确认当前工作树 rename，且不重写历史。

Proves:
- 缺少确认时 CLI 返回 rename 专属 flag 提示且 source 不变。
- 带确认 flag 的同一 rename 成功。
