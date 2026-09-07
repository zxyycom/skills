### Case DECISION-REALLOCATION-GRAPH-001: 重划分量保留角色并隔离断连图

Tests:
- `test:951702ee100305bc22e0d99c16521df98c9963fe192f7dd4e89771d0296a0b2c`

Tags:
- `decision-records`

Contract:
- 重划关系图必须以直接前序和直接后继的二部角色计算连通分量，且断连事件不得合并。

Proves:
- 共享一个前序的稀疏后继归入同一分量，并保留各自的前序与后继角色集合。
- 没有共享关系路径的重划边形成独立分量。
