### Case INVESTIGATION-STAGE-EXECUTABLE-DRIFT-001: 来源执行位漂移阻断写入

Tests:
- `test:32d30faaf187f55ba0d4e36ac35fd6d60327db1dbab8a2ee5d15fcaa31eede3c`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 选中来源写前核对同时覆盖字节与有效执行位，发现漂移不能发布 pending。

Proves:
- 第一次读取后只修改脚本执行位，第二次核对返回 source-drift，完整 index 字节保持原值。
