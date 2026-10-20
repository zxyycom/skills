### Case DECISION-SET-RELATIONS-ATOMIC-001: set-relations 多来源单一事务且失败零写入

Tests:
- `test:82a1817cff8c3ae50eb804670582b37409157b0370d2a2d6c1edac10f8b265c6`
- `test:83ab2750617d8860cdff6180ab76738f82af00b16336fd30496426398bf01804`
- `test:ac9a49daa22cf2b2f2cd802733e1253022097f3d183e3537b0666c5807a7e63c`

Tags:
- `decision-records`

Contract:
- 多个 `--source` 分组在同一请求中形成单一事务；任一来源解析失败或最终图非法时整体不写入。

Proves:
- 真实同进程 CLI 的双来源 replacement 成功共同更新索引；后续来源解析不存在时拒绝并保留来源与索引字节。
- 纯生命周期准备对关系目标仍为 active 的非法图返回 target must be archived，且结果不含 changes。
