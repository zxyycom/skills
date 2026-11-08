### Case DECISION-MERGE-ORDINARY-INTERSECTION-001: 事件内普通邻居保持 direct

Tests:
- `test:c6ee3e0eb7a24aaaae679167a7b256063c4619673d3119da055782a390e779db`

Tags:
- `decision-records`

Contract:
- 事件 direct 集合包含当前方向所有直接邻居与事件成员的交集，不限触发事件的同类型边。

Proves:
- 原生 trace 图中归并 m 指向 p1、p2，p1 又以普通修订指向 p2；从 p2 向后查一层时 m、p1 与 anchor 均为 trace，context 为空，无预算阻断。该节点未断言旧文本 frontier。
