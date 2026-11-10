### Case IR-CONFIG-INVALID-WRITE-GUARD-001: 非法配置在写入前失败

Tests:
- `test:0c5e1b76a32a8bad335d3e3bfcbcff4906ca92f9fea7f756e58c4d9949752223`
- `test:caaa2fb0c22dfb822b2c9cf0e6e2a90ce768b8b795641435fcbae255d55af615`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 非法资源策略、null 和不支持的配置版本在业务写入前失败；help/version 不依赖工作区配置。

Proves:
- 配置加载拒绝空 bands、零预算、非法级别、null、版本 2 与未知字段，后层有效值不能遮盖错误；CLI 在零预算配置下拒绝 publish，候选字节保持且不创建报告或索引，同一坏配置下 help/version 成功。
