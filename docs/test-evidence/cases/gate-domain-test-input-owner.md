### Case GATE-DOMAIN-TEST-INPUT-OWNER-001: 领域输入矩阵归属实际 consumer

Tests:
- `test:32548290c1511228774ee8f37435b7b582a2ca1bb17d3e66179a1626fbea31ee`

Tags:
- `repository-tooling`

Contract:
- 各域声明的 runtime、adapter、测试与 fixture 路径应保持输入闭合并激活真实所属消费者。

Proves:
- domainInputOwnershipCases 的每条路径变化后为 incremental、未知输入为空且命中期望能力/Check；另一领域与 Index Runtime、Task Graph、Novel Cards 独立检查 reuse。
- 逐条成功发布后相同输入 warm 无新增激活。
