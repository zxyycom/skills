### Case MCPSHELL-BRIDGE-FILE-008: workspace put reports outcome unknown when final acknowledgment is lost

Tests:
- `test:51ceb743b83634f232d34c22c625baa32d03d12a9dc1e01ba938be5c092f3109`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 的 final link/mv 后若 SSH transport 或 metadata marker 丢失，结果必须是 `outcome_unknown`，并携带 destination、预期 byte count 和 SHA-256；不得把可能已提交写入说成普通 protocol failure 或未写入。

Proves:
- fixture 在完整 remote commit 后删除 metadata marker 并返回 transport 255；result 为 `outcome_unknown`，evidence 完整，project destination 确实保留完整 source 内容。
