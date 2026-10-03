### Case LIGHTWEIGHT-JUDGMENT-CLI-023: 默认关闭与离线不建库

Tests:
- `test:6486b0bf7e87d60d88dcdcc6034f6b9be657824dc47fc9175833279705c755bb`

Tags:
- `lightweight-judgment`

Contract:
- 日志默认关闭；仅启用日志且输入和凭据前置通过的真实推理才访问数据库。

Proves:
- help、doctor、dry-run、非法输入、缺密钥及显式关闭日志均不创建数据库；空配置的推理成功后临时用户目录仍为空。
- doctor 回显默认 enabled=false、saveRequest=false、saveResponse=true 与用户数据目录下的数据库路径。
