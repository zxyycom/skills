### Case NATIVE-RECORD-DECISION-CANDIDATE-READINESS-001: 决策候选集合就绪状态

Tests:
- `test:b81784e341c7466577943c8921acc3446f4e7b4af117b53d37aee51886fb0ddf`

Tags:
- `record-rust`

Contract:
- 首次只有候选的决策集合检查须区分候选数量和正文就绪数量。

Proves:
- 私有未就绪候选的检查结果报告首次候选集合、一个候选及零个正文就绪候选。
