### Case UPDATER-SELECTED-CLI-REJECTION-001: 真实 CLI 非法选集零写拒绝

Tests:
- `test:bee65c05aeb7db05531768c3bb36e06a085ce592d92c4bbf2cab9e986b3b103c`

Tags:
- `repository-tooling`

Contract:
- 生成 CLI 必须在加载适配器及写入之前验证完整所选集合，不能用部分有效成员继续生成或接纳选组 write。

Proves:
- 健康隔离 fixture 上缺值、空名、路径、有效名加未知名及 write+skill 均由真实 CLI 退出 1；stdout 为空，stderr 匹配对应参数或身份错误，完整普通文件树 hash 始终不变。
- 有效领域 skill 的适配器设置为加载即抛出哨兵错误；该 skill 与未知名同选时仍报告未知名，证明完整选集校验发生在适配器加载之前。
