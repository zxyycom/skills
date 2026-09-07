### Case DECISION-EVOLVE-DISCARD-RELATION-HISTORY-001: Evolve discard 参数不绕过最终关系的历史确认

Tests:
- `test:30921e0d9a20149517913676ea5aaebfab7b2d64774a6ebd811dcb2aeb4edcd5`

Tags:
- `decision-records`

Contract:
- `--delete-recorded-decision` 只确认删除目标；最终关系指向尚未进入 Git HEAD 的已建立前序时，仍须以 `--keep-unrecorded-history` 明确保留该独立历史。

Proves:
- CLI 返回前序历史 attention，且后继、删除目标、前序 Markdown 与索引均保持不变。
