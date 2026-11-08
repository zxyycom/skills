### Case DECISION-CANDIDATE-ACTION-COMMIT-001: 候选改名删除不制造正式索引

Tests:
- `test:2ca385e8f555a6015e0b130fe50e5a9744a40c64a7951ef0a927aa45115373dc`

Tags:
- `decision-records`

Contract:
- 候选 rename/discard 沿用实际动作提交点，不为事务统一发布正式索引。

Proves:
- 无正式索引的私有集合中，原生事务先改名再丢弃唯一候选，均已提交；各步骤后均无 decision-index.json，删除后候选文件不存在。
