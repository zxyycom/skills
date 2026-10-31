### Case DR-INDEX-PAYLOAD-REQUIRED-FAILURE-001: 必需索引payload读取失败不可降级

Tests:
- `test:892b5e3000a5f651e556c21a1872c3dc1f1e69c84d477dc9ad967aa785a90890`
- `test:efff3922a0b148e2c9c65fd1c48f2d8eed6c734829837211e073d3edb7601fd4`

Tags:
- `decision-records`

Contract:
- content-paths只免除未消费payload验收，目标pending索引仍在准备和独立写前真实读取并验证。

Proves:
- 使P拥有区别于H的索引对象，在准备或独立复核前删除该对象，两阶段均失败且保留全部pending身份。
