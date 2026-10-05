### Case LIGHTWEIGHT-JUDGMENT-RESPONSE-PRESERVATION-001: CLI 原样保留 schema 有效响应

Tests:
- `test:553bb34110595832eadfa3fe0714e6ed3079fee0f460737f14f94722e97b9029`

Tags:
- `lightweight-judgment`

Contract:
- CLI 校验响应 schema 与题目对应，不用数值间推导关系拒绝或改写合法字段。

Proves:
- 单次混合问题调用返回成功并原样保留 Score、Choice、Noul、usage、id、provider 及答案额外字段，即使 Score 不等于展示概率的加权值、Choice 不是最大概率项且概率和不为 1；无重发或额外诊断。
- 字符串等级的对应 legend 与结构化等级的服务端自定义 legend 均原样保留；全零分布、零 confidence 与三位小数 score 不被归一化、补造或拒绝。
