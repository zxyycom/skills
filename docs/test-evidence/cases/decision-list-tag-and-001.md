### Case DECISION-LIST-TAG-AND-001: List 对重复标签采用 AND 筛选

Tests:
- `test:dfefe87d13b7da79839791cdc6e3583be7312ff7daad4e21b156adce1af0f76a`

Tags:
- `decision-records`

Contract:
- 重复 `--tag` 选择器必须取交集，而不是并集。

Proves:
- 真实 list 准备、内存快照投影及 renderer 对双 tag 仅输出同时持有两者的记录，不返回只持有其中一个 tag 的记录。
