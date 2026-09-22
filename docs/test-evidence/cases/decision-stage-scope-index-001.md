### Case DECISION-STAGE-SCOPE-INDEX-001: stage --scope index writes only the derived index projection

Tests:
- `test:4829e943a67b03f4b7fcdd6a82c6a011881b1d9ee72480e6e80a4bb4d96d8ee0`

Tags:
- `decision-records`

Contract:
- stage --scope index 只把所选记录的派生索引投影写入 pending，不写正式 Decision Markdown。

Proves:
- 真实 Git fixture 中暂存区只含 decision-index.json；pending 索引反映所选来源变化，所选 Markdown 无 cached 差异。
