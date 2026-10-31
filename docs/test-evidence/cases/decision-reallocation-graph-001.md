### Case DECISION-REALLOCATION-GRAPH-001: 重划分量保留角色并隔离断连图

Tests:
- `test:9776f8131a068e6292964a97b6b4e8523acbab50d71657804d0c29212b454671`

Tags:
- `decision-records`

Contract:
- 重划关系图必须以直接前序和直接后继的二部角色计算连通分量，且断连事件不得合并。

Proves:
- 共享一个前序的稀疏后继归入同一分量，并保留各自的前序与后继角色集合。
- 没有共享关系路径的重划边形成独立分量。
