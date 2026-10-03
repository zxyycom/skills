### Case LIGHTWEIGHT-JUDGMENT-CLI-004: 离线与凭据读取边界

Tests:
- `test:5971c8fed013b751a1071e98e00a5a9d635ffa697043a899b5eba1cda04c57db`

Tags:
- `lightweight-judgment`

Contract:
- help 不读取配置；dry-run 不读取密钥值；doctor 离线报告密钥存在性。

Proves:
- Proxy 阻断密钥读取时 dry-run 仍成功，缺密钥 doctor 返回 configuration/2且不联网。
