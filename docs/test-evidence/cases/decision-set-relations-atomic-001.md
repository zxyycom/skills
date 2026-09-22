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
- 双来源替换一次成功并共同更新索引。
- 后续来源不存在或替换指向活动记录（target must be archived）时以领域失败退出，先前合法来源与索引字节保持原值。
