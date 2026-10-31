### Case DECISION-CLI-ARGS-001: CLI 顶层帮助公开当前命令集合

Tests:
- `test:01a8ed65e4d44e38f120a7e8c19f08dd4bda1b1caa523bb6bb362147a6be9958`

Tags:
- `decision-records`

Contract:
- 顶层帮助必须准确公开当前命令集合：严格检查、candidate scaffold 源码查询、显式 new、默认全集验收及显式局部更新、统一 evolve 协议和 extensionless Decision ID 契约；帮助不声明默认命令，也不公开独立 split 命令。

Proves:
- 顶层帮助包含 agent-oriented 入口、严格检查、候选 scaffold/body readiness、默认全集验收与selected已知位置/必要依赖范围、new、show-candidate、evolve 以及单个终止 `.md` 兼容输入说明。
- 顶层命令列表不包含独立 split 命令，且不再出现默认命令说明。
