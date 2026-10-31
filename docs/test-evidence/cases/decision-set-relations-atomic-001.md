### Case DECISION-SET-RELATIONS-ATOMIC-001: set-relations 多来源单一事务且失败零写入

Tests:
- `test:9eb1556c468e1d0d3ea8ca8bcd2d47faae36023a55510314ac55411d79aa8c82`
- `test:aeef6d08bc41ac9bb81aef93c32da15cdfdf9afc24745d20a76f8becabfb58d7`
- `test:bcb877908c9ca5ba87a1e682bfca212e305aae1141612a4370982c0ce2dc3b7a`

Tags:
- `decision-records`

Contract:
- 多个 `--source` 分组在同一请求中形成单一事务；任一来源解析失败或最终图非法时整体不写入。

Proves:
- 真实同进程 CLI 的双来源 replacement 成功共同更新索引；后续来源解析不存在时拒绝并保留来源与索引字节。
- 纯生命周期准备对关系目标仍为 active 的非法图返回 target must be archived，且结果不含 changes。
