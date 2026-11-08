### Case DECISION-CLI-EVOLVE-SUCCESSOR-REQUIRED-001: Evolve 要求显式后继

Tests:
- `test:a6ec5a4bef400102ce36865106ade68e4ef6d8ab41757e2153db216e418ae608`

Tags:
- `decision-records`

Contract:
- Evolve 必须显式指定至少一个 successor；discard 是可选的附加操作。

Proves:
- 真实原生 CLI 的无 successor 调用及带 discard 的无 successor 调用均退出 2，以 JSON 报告 invalid-arguments，且不创建领域目录。
