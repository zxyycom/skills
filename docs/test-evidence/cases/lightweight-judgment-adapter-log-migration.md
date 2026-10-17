### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-010: 显式 v2 到 v3 迁移与未知合同

Tests:
- `test:49c66d26c6a0284455419ac9252a51d68ddc54ed652e7af264e1c73915d96f4f`

Tags:
- `lightweight-judgment`

Contract:
- 正常调用和 stats 不自动升级 v2；显式副本迁移逐值保留旧列，新合同来源未知时为 NULL，统计不读取正文猜测。

Proves:
- 合成 v2 库正常统计拒绝且字节不变；随包 SQL 保留旧值／BLOB 并新增两列 NULL；重复或结构不符迁移可回滚，adapter 分组及批次筛选保持 NULL 与局部 cohort。
