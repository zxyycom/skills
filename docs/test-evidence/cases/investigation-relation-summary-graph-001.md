### Case INVESTIGATION-RELATION-SUMMARY-GRAPH-001: 关系归一化拒绝重复目标

Tests:
- `test:0eb416053745392aa788afdaf7afae9ca3f98c37557502cfd1b5e4cf62c6e2e3`
- `test:f92111b2396839c984f7972b88beab3d7386960a8292ca418ba33c2e7f31403f`

Tags:
- `investigation-report`

Contract:
- 同一关系组不能以不同摘要绕过重复目标约束。

Proves:
- 调查关系归一化对重复相同 target 返回 DuplicateTarget；共享关系计划对同目标、摘要不同的两条边亦返回 DuplicateTarget。
