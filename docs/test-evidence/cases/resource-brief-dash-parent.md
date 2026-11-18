### Case RESOURCE-BRIEF-DASH-PARENT-001: 摘要区分短横线父集合与顶层

Tests:
- `test:e9461605a066ebcf786d134480ee206bdf4aa22d7d4da5b6b9b399a1f109c29e`

Tags:
- `resource-records`

Contract:
- `-` 是合法的集合 ID；摘要省略顶层集合的 parent 字段，并输出子集合的真实父 ID。

Proves:
- 私有记录中顶层集合 ID 为 `-`，其子集合以 `-` 为 parent；同步后，同一次 `list --brief` 中顶层行无 parent 字段，子集合行含 `parent=-`。
