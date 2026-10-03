### Case LIGHTWEIGHT-JUDGMENT-CLI-008: 协议异常不修复

Tests:
- `test:c2938588cf257072360d3bdcf1278d9ed392c09659104ca864888ecded5dd9fc`

Tags:
- `lightweight-judgment`

Contract:
- 错误协议是技术失败，不改选、归一化或重新发送。

Proves:
- 不可解析、错误模型、缺答案、非最大 Choice 等异常返回 invalid_response 与 null result，且不输出原始材料或重试；畸形 JSON、重复键、下溢、额外精度、模型、答案集合、Noul 范围、概率和、Choice 最大项与 Score 加权错误各给出可区分的静态位置和原因，问题用零基 ordinal 定位，合成敏感题 ID、远端键、模型值、state 与密钥均不泄露。
