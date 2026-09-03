### Case MCPSHELL-BRIDGE-FILE-008: workspace put reports outcome unknown when final acknowledgment is lost

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace put reports outcome unknown when final acknowledgment is lost`
- `bun test --test-name-pattern="^workspace put reports outcome unknown when final acknowledgment is lost$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- put 的 final link/mv 后若 SSH transport 或 metadata marker 丢失，结果必须是 `outcome_unknown`，并携带 destination、预期 byte count 和 SHA-256；不得把可能已提交写入说成普通 protocol failure 或未写入。

Proves:
- fixture 在完整 remote commit 后删除 metadata marker 并返回 transport 255；result 为 `outcome_unknown`，evidence 完整，project destination 确实保留完整 source 内容。
