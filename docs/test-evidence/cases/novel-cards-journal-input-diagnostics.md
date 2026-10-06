### Case NOVEL-CARDS-JOURNAL-INPUT-DIAGNOSTICS-038: 恢复日志失败定位

Tests:
- `test:2f1a12aa0d1efbd72f3f2aeef968e81f35fe61f734589c27e6e884c6eebd6d04`

Tags:
- `novel-cards`

Contract:
- 恢复journal重新进入独立文件与JSON边界；无法解析或校验时须定位journal文件并保留现场，不改写旧卡、索引或恢复依据。

Proves:
- journal包含非法JSON、缺少必填字段或非法UTF-8时均退出1并输出error，诊断包含journal文件路径；人物卡、索引与journal原字节均不变。
