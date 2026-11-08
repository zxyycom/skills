### Case DECISION-CLI-EVOLVE-RECORDED-FLAG-001: 已记录删除确认须配合 discard

Tests:
- `test:a6ec5a4bef400102ce36865106ade68e4ef6d8ab41757e2153db216e418ae608`

Tags:
- `decision-records`

Contract:
- evolve 的 delete-recorded 确认作用于 discard 所选目标，不能单独使用。

Proves:
- 真实原生 CLI 带 successor 但无 discard 地使用 delete-recorded，退出 2、invalid-arguments，且未创建领域目录；不承诺旧文本诊断。
