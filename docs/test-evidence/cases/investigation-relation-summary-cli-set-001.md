### Case INVESTIGATION-RELATION-SUMMARY-CLI-SET-001: CLI set-relations scopes summaries to complete source groups

Tests:
- `test:2a756993b1801102f3be27aab569ebc932a55f7471f7da31024c2d1f5c7ad56f`

Tags:
- `investigation-report`

Contract:
- `set-relations` 将 relation-summary 归属最近 source group，允许组内任意顺序；解析 target 后只绑定该组完整 relation set，未提供摘要的完整替换清除旧值。

Proves:
- 多 source group 分别绑定 ID/name 形式的 target，summary 可位于 relation 前后并保留正文 `=`。
- 后续无 summary 的完整替换清除旧摘要；summary-only、clear 冲突、解析后重复 target 和组内未命中 target 均拒绝。
