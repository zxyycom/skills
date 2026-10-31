### Case LIGHTWEIGHT-JUDGMENT-CLI-020: 缺失本地密钥是配置前置失败

Tests:
- `test:c89d03b6460790f6fbcd5a6ecc4aef48540bca17b3e4ebed15e45aa1d09ef03b`

Tags:
- `lightweight-judgment`

Contract:
- doctor 与普通推理缺失或空白本地密钥时 configuration/2，只有服务实际拒绝鉴权才 authentication/3。

Proves:
- 缺失、空串与空白 key 在两个入口均返回 configuration/2、null result、attempts 0，fetch 从未调用。
