### Case DECISION-REALLOCATION-DIRECT-CONTEXT-001: 稀疏重划按方向与深度区别 direct 与 context

Tests:
- `test:606ba8c2b15c7bcf3797ebc021487cc8920d0ffc0a2a26ef7f8c8093d1dc371c`

Tags:
- `decision-records`

Contract:
- 完整重划组件用于事件接纳，直接 trace 仍只来自当前 from/direction 邻居；context 只有真正到达后才能提升。

Proves:
- s1→p1,p2 与 s2→p2,p3 在单向一层仅 p1/p2 新增 trace；both 后续到达 s2 再到 p3；不足预算全事件阻断，完整 coverage/frontier/blockedEvent 保持预期。
