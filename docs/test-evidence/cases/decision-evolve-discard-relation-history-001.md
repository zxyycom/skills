### Case DECISION-EVOLVE-DISCARD-RELATION-HISTORY-001: Evolve discard 参数不绕过最终关系的历史确认

Tests:
- `test:bb8acc9f8f92b8e9170af8e153465f040f635818e0e29c72352dfe5964549a7a`

Tags:
- `decision-records`

Contract:
- `--delete-recorded` 只确认删除目标；最终关系指向尚未进入 Git HEAD 的已建立前序时，仍须以 `--keep-unrecorded-history` 明确保留该独立历史。

Proves:
- argv 解析和领域准备对 deleteRecorded=true、删除目标已记录但最终前序不在显式已记录集合的输入仍要求历史，返回 attention；不含 changes/relationReview，诊断 outcome 均为 no-change。
- attention renderer 退出码 1、stdout 为空，stderr 指明未记录前序并提示 keep-unrecorded-history。
