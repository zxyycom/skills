### Case INVESTIGATION-LAZY-EVIDENCE-001: 合法发布图的关系证据稳定

Tests:
- `test:4796ddd444cc0857d2adcbcb360f3393332643a602d2e159b91ed4296a473db5`

Tags:
- `investigation-report`

Contract:
- 合法发布图的记录输入顺序不改变关系筛选结果及证据的目标顺序和摘要。

Proves:
- IR 真实 CLI 对正序和逆序记录构造的发布索引返回相同结果；归并记录的两条 filterRelations 按目标排序并保留对应摘要。
- 原生发布索引要求关系数组唯一且已排序，旧内部 context 可接受逆序关系数组的承诺不再适用；错误聚合不属于此 Case。
