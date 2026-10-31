### Case MCPSHELL-BRIDGE-FILE-009: workspace put does not delete a replacement when final containment is unknown

Tests:
- `test:4acd2f1ba5c2b5297bd677f4ecd6041638d4091eb97ff9f779d1d44779a91221`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put trap 只能清理明确拥有的 temporary；final commit 后 containment 无法确认时必须返回 `outcome_unknown`，不得按 basename rollback 并误删并发 replacement。

Proves:
- fixture 令 no-replace link 成功后移动 parent 并写入 replacement；result 为 `outcome_unknown`，移动目录中的 replacement 仍存在。
