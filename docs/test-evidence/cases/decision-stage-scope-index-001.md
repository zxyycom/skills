### Case DECISION-STAGE-SCOPE-INDEX-001: stage --scope index writes only the derived index projection

Tests:
- `test:13337f4e9b14593e0df8debc5dd9c6470a7e72160aaf36e0785cda7d21ef0373`
- `test:dca3fbd723a76c5f76404de687ea00ed30673148c224a57535df8b257684c1ee`

Tags:
- `decision-records`

Contract:
- stage --scope index 只把所选记录的派生索引投影写入 pending，不写正式 Decision Markdown。

Proves:
- 纯领域 target 与生产索引构建把所选来源的新 title 写入派生 entry。
- 真实 CLI 的 index 步骤暂存路径只有 decision-index.json，不夹带已修改的正式 Markdown。
