### Case DECISION-CANDIDATE-ACTION-COMMIT-001: 候选改名删除不制造正式索引

Tests:
- `test:0634a761e022efa12998f8e1b09d3f712a9931f311f2f58612bab837452f2ead`

Tags:
- `decision-records`

Contract:
- 候选 rename/discard 沿用实际动作提交点，不为事务统一发布正式索引。

Proves:
- 真缺索引工作区候选改名和删除均成功且变化生效，操作前后始终没有 decision-index.json。
