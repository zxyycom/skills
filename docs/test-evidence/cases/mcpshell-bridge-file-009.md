### Case MCPSHELL-BRIDGE-FILE-009: workspace put does not delete a replacement when final containment is unknown

Tests:
- `test:a0a81b0f2694c98fdee612d5994e990cfcd0ed8ea5cdbec2b79b896950a35ca5`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put trap 只能清理明确拥有的 temporary；final commit 后 containment 无法确认时必须返回 `outcome_unknown`，不得按 basename rollback 并误删并发 replacement。

Proves:
- fixture 令 no-replace link 成功后移动 parent 并写入 replacement；result 为 `outcome_unknown`，移动目录中的 replacement 仍存在。
