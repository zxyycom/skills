### Case NATIVE-RECORD-TXN-CAPTURE-DIAGNOSTICS-001: 事务后验与恢复的采集错误

Tests:
- `test:143c27540ddfdb5eaae6aa7e6e0f26a5032d423d79fb4a1d4fba9537efe528e7`
- `test:809470a2ddd5b842c5352ebd629f61131adbb32b23ef0bdca2ecd3ca82c74ba5`
- `test:861467536f1fed61a87a8badff57b30b172ea9f07987a4cee757def925bc0312`
- `test:ce8e861185bdbcde9a592bacca97f4d5359839027876868c310e19b63c09efe0`
- `test:f5aa39bc1f33a36bfcfd00be4a8ca40bd1731bcf308264e3987ed3a0b8032776`

Tags:
- `record-rust`

Contract:
- 写后复核和恢复复核须区分无法采集与实际漂移，并保留可证明的提交或恢复事实。

Proves:
- 私有文件系统注入 written、removed、现存和缺失 guard 的采集错误及实际漂移，核对路径原因、提交后不回滚和恢复校验继续收集；不声称覆盖所有操作系统错误。
