### Case INVESTIGATION-RELATION-TRANSACTION-PARSE-001: 关系参数拒绝缺失 source 与清空冲突

Tests:
- `test:84fb4c401eda13363c61976627f7e8d5fad9e98a4cca1bb1aa28b118baabc22a`

Tags:
- `investigation-report`

Contract:
- set-relations 解析须拒绝不完整或冲突的来源组。

Proves:
- 调查领域解析拒绝 relation 出现在 source 之前，亦拒绝同组 clear-relations 与 relation 混用。
