### Case DECISION-CLI-EVOLVE-RELATION-GROUPS-001: Evolve 拒绝不合法的关系分组

Tests:
- `test:320fde9d3a0ba83c866f78352fb7415ba9be78162aafab473d823f61af629adb`
- `test:6e47f8cda3c29049a6d3c915454f4c20fe67bb4cc28b7a38cdd5d44d6ef55fe9`

Tags:
- `decision-records`

Contract:
- 关系分组不得包含重复来源、重复目标、空组、清空与关系混用或无关系的摘要。

Proves:
- 真实 Decision evolve 参数解析对上述五类输入逐一返回错误；独立真实 CLI 入口测试确认代表性无效查询和 mutation 参数以退出 2、JSON invalid-arguments 输出。两项是组合证据，未对每类分组和另一领域逐一启动进程。
