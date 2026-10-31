### Case LIGHTWEIGHT-JUDGMENT-CLI-021: 显式自定义调用连接

Tests:
- `test:92b094903339dbdaedd0fbb785427ef056a5a8aaf7df3af0f2e8892ee173f8a2`

Tags:
- `lightweight-judgment`

Contract:
- endpoint 与密钥只由可信配置及 endpoint 参数决定；直接密钥优先于环境变量，doctor 只报告来源。

Proves:
- 配置中的完整 endpoint 与直接密钥进入 mock HTTP，环境密钥不覆盖直接密钥；--endpoint 只覆盖本次地址，回环 HTTP 可用，非回环 HTTP 返回 2。
- doctor 报告 config 或 environment 来源且不输出直接密钥。
