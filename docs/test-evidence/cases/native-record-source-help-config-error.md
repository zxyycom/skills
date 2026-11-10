### Case NATIVE-RECORD-SOURCE-HELP-CONFIG-ERROR-001: 坏配置不阻断帮助或伪装正常回退

Tests:
- `test:98f5edd4837e0d22587fb93c81475078f4b4adb2bed16ce3cf189b544e5708c4`

Tags:
- `cli-help`
- `investigation-report`
- `record-rust`

Contract:
- 来源配置非法时基础帮助仍可读取，但必须报告来源诊断，不能静默显示一个正常 fallback 选择。

Proves:
- 非法本地 JSON 下 --help 退出 0，stdout 含 Usage、Source diagnostic 与本地配置文件名，不含 Selected。
