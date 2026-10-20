### Case DECISION-CANDIDATE-SCAFFOLD-READINESS-001: 合法 candidate scaffold 在正文 ready 前仍可发现

Tests:
- `test:a13c0ff27e008a9a222144b76f0122f7b0207b1e7a1a8d792a8bc348aa45a2d9`

Tags:
- `decision-records`

Contract:
- 结构合法但固定正文尚未完成的 candidate scaffold 必须作为可发现的 candidate 保留，且不能被误判为可建立的 activation candidate。

Proves:
- 来源扫描器解析内存 scaffold Markdown 无 sourceErrors 且能找到该 candidate；scaffoldValid=true、bodyReady=false、activationCandidate=false，activation candidate 数量为零，类型守卫只承认 candidate 而不承认 activation candidate。
