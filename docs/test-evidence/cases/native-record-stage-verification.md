### Case NATIVE-RECORD-STAGE-VERIFICATION-001: Stage 写后复核的状态与错误分类

Tests:
- `test:458b45aa941ed79d685f9e524e7a4a8509b9305861899759cbf96518d90a8d44`
- `test:da2755cc0d989d47f84fa334548eac8302ce92847e9d35c88e597b633638b12c`

Tags:
- `record-rust`

Contract:
- Stage 无写入时须区分来源读取失败和漂移；写入后复核失败不能否认已提交事实。

Proves:
- 私有 Git 中注入复核错误，核对无写入分类、提交未验证状态、实际 index 字节及锁清理。
