### Case DECISION-CANDIDATE-SCAFFOLD-READINESS-001: 合法 candidate scaffold 在正文 ready 前仍可发现

Tests:
- `test:88ae748876d431f17b4c3ab9331072c33dc9b093ef8b8f676c1a7fedff55f6eb`
- `test:b81784e341c7466577943c8921acc3446f4e7b4af117b53d37aee51886fb0ddf`

Tags:
- `decision-records`

Contract:
- 结构合法但固定正文尚未完成的 candidate scaffold 必须作为可发现的 candidate 保留，且不能被误判为可建立的 activation candidate。

Proves:
- 原生 check 从只有 scaffold 的实际集合识别 1 个候选，正文 ready 数为 0；独立正文评估验证 scaffold 合法但未就绪。两节点不声明旧 TS 类型守卫契约。
