### Case TASK-GRAPH-LIST-DENSE-RELATIONS-001: 任一关系列表超过三个 endpoint 时 node 使用 block form

Tests:
- `test:8f517f242ec6433af80161f19a31eeab9f0eb9db8ba7bbc7e47f91c169aea47b`

Tags:
- `task-graph`

Contract:
- Columns 为 80 时，去重后的 needs、blocked-by 或 active mutex 任一列表超过三个 item，都独立触发 node block form。

Proves:
- Needs、blocked-by 和 mutex 三个矩阵场景都把四个排序后的 item 放入对应 continuation，且不产生其他关系 token。
- Mutex 场景同时保留 running、recovery-needed 和 mutex-blocked 摘要计数。
