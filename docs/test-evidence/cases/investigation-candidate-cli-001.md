### Case INVESTIGATION-CANDIDATE-CLI-001: 候选创建成功与正文未就绪分离

Tests:
- `test:a55abd86facf4cb1a8b43953e0695b70b89ac26fe7f9fd938a29623210ff99cc`

Tags:
- `investigation-report`

Contract:
- 真实 CLI 可成功创建 scaffold 有效但正文未就绪的候选。

Proves:
- JSON 结果报告 created 和 scaffoldValid 为 true、bodyReady 为 false。
