### Case LIGHTWEIGHT-JUDGMENT-CLI-008: 协议异常不修复

Tests:
- `test:c2938588cf257072360d3bdcf1278d9ed392c09659104ca864888ecded5dd9fc`

Tags:
- `lightweight-judgment`

Contract:
- 错误协议是技术失败，不改选、归一化或重新发送。

Proves:
- 响应及答案的非对象形状、答案映射非法、必填字段缺失、type 错配，以及畸形 JSON、重复键、下溢、额外精度、模型、答案集合、Noul 范围、概率范围、非候选 Choice 与 Score 范围错误均返回 invalid_response、退出 3 与 null result；stdout/stderr 保留相应静态位置和原因，且只发送一次。
- 问题用零基 ordinal 定位；合成敏感题 ID、远端键、非法响应值、模型值、state 与密钥均不泄露。
