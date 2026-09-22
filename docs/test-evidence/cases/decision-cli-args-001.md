### Case DECISION-CLI-ARGS-001: CLI 顶层帮助公开当前命令集合

Tests:
- `test:1435a7fb9c09ba3a296de94c51511e5e29060a00ce198f46e6a8ed9218563dbd`

Tags:
- `decision-records`

Contract:
- 顶层帮助必须准确公开当前命令集合：严格检查、candidate scaffold 源码查询、显式 new、直接重建正式索引、统一 evolve 协议和 extensionless Decision ID 契约；帮助不声明默认命令，也不公开独立 split 命令。

Proves:
- 顶层帮助包含 agent-oriented 入口、严格检查、候选 scaffold/body readiness、直接重建索引、new、show-candidate、evolve 以及单个终止 `.md` 兼容输入说明。
- 顶层命令列表不包含独立 split 命令，且不再出现默认命令说明。
