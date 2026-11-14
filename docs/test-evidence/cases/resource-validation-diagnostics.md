### Case RESOURCE-VALIDATION-DIAGNOSTICS-001: 资源记录字段诊断定位

Tests:
- `test:4ffd93116201a9030d0702f0ecde56bf8dcce5e47ef5e6cfad1d1149864c991f`

Tags:
- `resource-records`

Contract:
- 非法资源记录应以来源文件及具体字段诊断，帮助修复记录；结构约束仍由资源记录契约承接。

Proves:
- 真实 CLI 对文件 role、sha256、gap、位置路径、关系证据和成员 ID 的 7 种非法输入返回退出码 1，消息包含来源文件及对应字段和原因。
- 对用途选择的 slot、basis、scope、目标资源 ID 和证据 locator 的 5 种非法输入返回退出码 1，消息包含集合文件及对应字段和原因；未证明其他字段的诊断定位。
