### Case LIGHTWEIGHT-JUDGMENT-CLI-020: 缺失本地密钥是配置前置失败

Tests:
- `test:a814f594ebb6bdf3c2a1d7616860b007b49c1c6bcc7ff5adbdd1ded5a659e1a8`

Tags:
- `lightweight-judgment`

Contract:
- doctor 与普通推理缺失或空白本地密钥时 configuration/2，只有服务实际拒绝鉴权才 authentication/3。

Proves:
- 缺失、空串与空白 key 在两个入口均返回 configuration/2、null result、attempts 0，fetch 从未调用。
