### Case DECISION-REALLOCATION-DIRECT-CONTEXT-001: 稀疏重划按方向与深度区别 direct 与 context

Tests:
- `test:f0cf375cd2958a20e91d5962ba51cb0ac8a945a0890248239213e105381bdefb`

Tags:
- `decision-records`

Contract:
- 完整重划组件用于事件接纳，直接 trace 仍只来自当前 from/direction 邻居；context 只有真正到达后才能提升。

Proves:
- 稀疏图中单向一层仅接纳 anchor 和两个直接前序为 trace，另一个后继及第三个前序只作 context；预算不足时整个事件阻断并返回完整成员和所需预算。
- 双向不限深度遍历后通过直接边到达全部成员，原 context 晋升为 trace，context 为空且 coverage 完整。
