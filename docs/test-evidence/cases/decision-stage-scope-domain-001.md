### Case DECISION-STAGE-SCOPE-DOMAIN-001: stage --scope domain writes only formal Markdown and preserves the pending index

Tests:
- `test:101ec0b9ef6515e96fed773fc1ec3c9e86ef3a5b437fb7257b2c1bbfdf3bf32b`

Tags:
- `decision-records`

Contract:
- stage --scope domain 只写所选正式 Markdown，pending 索引按当前字节原样保留。

Proves:
- 暂存区只含所选 Markdown；索引无 cached 差异，结果报告 preserved 与 caller-owned 索引路径。
