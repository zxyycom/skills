### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-001: 适配合同与凭据隔离

Tests:
- `test:87aa775692550a9a2ee8961603e06ba81cb2ec40f4bda9eed01aab5e71bceab3`

Tags:
- `lightweight-judgment`

Contract:
- 新增 adapter 显式声明目标、模型和凭据；不合法来源或实验组合在发送前拒绝，密钥不跨命名空间回退。

Proves:
- 未知或不完整 adapter、跨合同模型与实验组合被离线拒绝；请求 model 与 CLI 覆盖分别校验，直接 OAI 的 doctor 和无密钥 dry-run 被核对；仅尝试读取指定凭据变量，错误 attempts=0。
