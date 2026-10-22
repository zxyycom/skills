### Case DR-INDEX-PAYLOAD-REQUIRED-FAILURE-001: 必需索引payload读取失败不可降级

Tests:
- `test:60ec34523942f5c2cb68e46c9e4ae6c0f46f767d8b4b13403087afc2265a899f`
- `test:8821a0cece884fe19a62e3b9cc462ced831146a57ebedce0a45190520a22ccc1`

Tags:
- `decision-records`

Contract:
- content-paths只免除未消费payload验收，目标pending索引仍在准备和独立写前真实读取并验证。

Proves:
- 使P拥有区别于H的索引对象，在准备或独立复核前删除该对象，两阶段均失败且保留全部pending身份。
