### Case LIGHTWEIGHT-JUDGMENT-CLI-005: 输入与配置前置校验

Tests:
- `test:666058ecf4e37e2cec60cc5102808cdc43f06c2b298f29b74cfb475dd749a364`

Tags:
- `lightweight-judgment`

Contract:
- 未知参数、冲突输入、错题型与非法配置在发送前失败。

Proves:
- 配置拒绝非回环明文 HTTP、URL 凭据／查询／片段、相对 endpoint、空白密钥、错误类型的日志开关、空日志路径及日志内的未知 prototype-named 字段。
- 来源冲突、重复选项、顶层外发配置后门、非法配置字段和显式缺失配置返回 2，fetch 未调用；被 CLI model 覆盖的非法请求 model 与配置仍被拒绝；配置的非整数、字符串和超出定时器范围的超时被拒绝，CLI 的零、负数、小数、前导零与越界超时返回 input 且 attempts 为 0。
