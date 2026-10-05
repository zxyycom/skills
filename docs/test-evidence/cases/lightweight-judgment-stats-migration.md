### Case LIGHTWEIGHT-JUDGMENT-STATS-MIGRATION-001: 显式 SQL 升级副本并保留原库

Tests:
- `test:6a04951394e3c5cd70739da8060f64a1dd4a42e01d00efe78a82a372b5b20808`

Tags:
- `lightweight-judgment`

Contract:
- 已知 v1 通过独立版本迁移记录附带的 SQL 脚本 在副本上升级为当前结构，保留所有旧字段与记录，新增字段按来源回填，缺失来源保持 NULL；正常读写不承担迁移。

Proves:
- 直接执行随包 SQL 脚本 后，副本完整性正常、版本为 2，全部原字段保留，留存请求的字节数回填为 8，无来源的字段保持 NULL，当前 stats 与 writer 成功；原库版本、记录及字节保持不变。
