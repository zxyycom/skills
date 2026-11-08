### Case DECISION-CANDIDATE-DISCARD-UNRECORDED-001: Discard 删除未被已记录集合包含的候选

Tests:
- `test:1fd2828410042efca7e832a379aa21056ce7ced025f92b12bdfcef1ac361a597`

Tags:
- `decision-records`

Contract:
- 未记录候选可在无需删除已记录对象确认的情况下丢弃，且不改正式索引。

Proves:
- 非 Git fixture 中候选改名后无确认 discard 成功删除来源，正式索引字节不变。
