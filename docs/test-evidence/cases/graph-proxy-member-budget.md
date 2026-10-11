### Case GRAPH-PROXY-MEMBERS-001: Proxy 成员变化重算预算而非复用成功组

Tests:
- `test:2244be2c75dc0484d74e9f92cb33b9a21f905de43b2e03ac813e470fa9d1ba82`

Tags:
- `relation-graph`

Contract:
- 成功成员接纳标记只适用于已证明不变的私有成员事实；动态成员变化重新检查原子预算。

Proves:
- 同一/不同单位的 Proxy 成员从两项增至三项时，预算 2 阻断并报告 required=3 及精确 frontier，预算 3 全部接纳。
