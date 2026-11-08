### Case DECISION-EVOLVE-DUPLICATE-SUCCESSOR-001: Evolve 拒绝重复后继

Tests:
- `test:a6ec5a4bef400102ce36865106ade68e4ef6d8ab41757e2153db216e418ae608`

Tags:
- `decision-records`

Contract:
- 一次 evolve 的 successor 集合中每个规范身份只能出现一次。

Proves:
- 真实原生 CLI 使用相同 selector 声明两个不同 alignment 的 successor，退出 2、invalid-arguments 且未创建领域目录；此节点不覆盖不同别名解析为同一身份。
