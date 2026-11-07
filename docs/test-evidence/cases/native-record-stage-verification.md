### Case NATIVE-RECORD-STAGE-VERIFICATION-001: Stage 写后复核的状态与错误分类

Tests:
- `test:458b45aa941ed79d685f9e524e7a4a8509b9305861899759cbf96518d90a8d44`
- `test:98ac0a409ac6f2ca7eed2585c11b831ed493680648c84a8af6959bc88f600c99`
- `test:da2755cc0d989d47f84fa334548eac8302ce92847e9d35c88e597b633638b12c`

Tags:
- `record-rust`

Contract:
- Stage 无写入时须区分来源读取失败和漂移；写入后复核失败不能否认已提交事实。

Proves:
- 私有 Git 注入复核错误并核对实际 index 和锁清理；独立 recheck 验证 index 同字节同权限替换可接受、权限改变被拒绝。
