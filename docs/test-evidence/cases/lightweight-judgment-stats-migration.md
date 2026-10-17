### Case LIGHTWEIGHT-JUDGMENT-STATS-MIGRATION-001: 显式 SQL 升级副本并保留原库

Tests:
- `test:6a04951394e3c5cd70739da8060f64a1dd4a42e01d00efe78a82a372b5b20808`

Tags:
- `lightweight-judgment`

Contract:
- 已知 v1 通过 v1→v2 与 v2→v3 的独立 SQL 链在副本上升级为当前结构，保留所有旧字段与记录，新增字段按来源回填，缺失来源保持 NULL；正常读写不承担迁移。

Proves:
- 直接执行 v1→v2 随包 SQL 后，副本完整性正常、版本为 2，全部原字段保留，留存请求的字节数回填为 8，无来源的字段保持 NULL。
- v1 副本先保留并校验 v2 回填值，再执行 v3 显式迁移后可正常统计与写入；原库保持 v1 且字节不变。
