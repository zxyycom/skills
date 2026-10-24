### Case GATE-FUNCTION-LIMIT-POLICY-001: 自动化与测试函数限额独立配置

Tests:
- `test:485514687b0eb2457322bf2c0fb8060cc80b92ae413007926a574d2142f079e2`

Tags:
- `repository-tooling`

Contract:
- 自动化与测试使用各自项目声明限额，不由一个生产常量反推预期。

Proves:
- 对两区配置逐项比较独立字面限额，只证明项目政策，不复测上游分析算法。
