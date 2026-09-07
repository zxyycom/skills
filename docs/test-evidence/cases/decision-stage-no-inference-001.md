### Case DECISION-STAGE-NO-INFERENCE-001: Stage 不把无关的相同删除/新增绑定为改名

Tests:
- `test:25f51032c6cfcb90ffb19f383737c5301f3c82a399c386c59967ea80daf82b63`

Tags:
- `decision-records`

Contract:
- CLI 不从文本相同的删除/新增推断身份改名。

Proves:
- 暂存条目保持独立 D/A，而非 rename。
