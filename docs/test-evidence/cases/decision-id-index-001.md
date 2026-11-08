### Case DECISION-ID-INDEX-001: State-only ID 键索引

Tests:
- `test:aa8b51aa7b298b7f3ee8cf34bcacab13bd0e40dd32b4f91e483e9d9c585d020e`

Tags:
- `decision-records`

Contract:
- Decision 已发布索引以稳定 ID 对齐 entries 与 sourceRevision，并接受状态投影。

Proves:
- DR 完整 check 对同 ID 的来源、索引状态及 revision 构建一致时成功；正文变更后报告索引不再当前。
