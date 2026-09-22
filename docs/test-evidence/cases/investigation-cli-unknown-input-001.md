### Case INVESTIGATION-CLI-UNKNOWN-INPUT-001: 旧命令与旧参数按普通未知输入失败

Tests:
- `test:94a9e283d45bbecc68087c2cfc9c095270b5af90ddc50bae522c204927139d34`

Tags:
- `investigation-report`

Contract:
- 被移除的旧命令与旧参数只得到普通未知命令或未知选项结果，以参数错误退出码结束；实现与诊断不保留兼容别名、弃用分支或迁移专用提示。

Proves:
- 未知命令与未知选项调用都以退出码 `2` 结束、stdout 为空，stderr 只包含普通未知输入诊断，不出现弃用或迁移文案。
