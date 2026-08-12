# Proposal

本 draft Change 记录扩展 `decision-records stage` 的方向：让新领域及其首批显式选择的决策能够组成同一个合法的 `pending` 决策快照。

## Why

当前 `stage` 在仓库已经存在决策版本时固定使用 `revision` 中的 `decision-domains.json`，只把显式选择的决策 Markdown 从 `filesystem` 叠加到该基线。因而，当一次提交同时新增领域目录项和该领域的首批决策时，目标决策在基线领域表中没有归属，命令会在写入 `pending` 前拒绝目标集合。

本次两条决策同时新增 `engineering-guidance` 领域，触发了这一边界。按本次操作记录，手工从目标领域表和目标决策重建的派生索引已经核对为正确的原子快照，但该做法绕过了 Decision Records Skill 的 `stage` 抽象；它只能作为需要提前披露的例外，不能成为后续维护流程。现有行为是已明确记录并对齐的首版边界，因此后续实现需要作为能力演进处理，而不是静默放宽校验。

## Outcome

`decision-records stage` 能够显式选择一个尚未进入 `revision` 的新领域及其首批决策，从同一目标来源生成领域目录表、决策 Markdown 与完整派生索引，并原子替换 `pending` 决策范围；未选择的领域变化、决策变化和范围外 `pending` 内容继续保持隔离。Skill 契约、长期决策、CLI 行为和测试证据共同说明这一能力与失败边界，不再要求调用方手工派生索引。
