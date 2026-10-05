### Case LIGHTWEIGHT-JUDGMENT-LOG-UPGRADE-ROLLBACK-001: 迁移身份检查与失败回滚

Tests:
- `test:3908440312f04cb8e5399f2959950a341670a9f35e1301418a03f002ea852c5c`

Tags:
- `lightweight-judgment`

Contract:
- 显式迁移 SQL 只适用于已知 v1；身份或版本不符时拒绝，执行中失败须停止并回滚，不能提交半迁移结构。

Proves:
- 随包 SQL 脚本 在外来应用 ID、版本 2／3 下报错；末尾待添加列已存在时，在前面列变更后报错；同名索引冲突则在新增列与字节数回填后报错。各场景按指南 ROLLBACK 后数据库字节保持原样。
