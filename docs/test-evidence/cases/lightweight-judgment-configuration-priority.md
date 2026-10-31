### Case LIGHTWEIGHT-JUDGMENT-CLI-003: 配置与覆盖优先级

Tests:
- `test:c7ee847f69c28d3872d97c3bee7750895e26359c7f5f13f0028d366a2440ef41`

Tags:
- `lightweight-judgment`

Contract:
- 显式配置优先环境选择，不跨文件合并；模型依 CLI、请求、配置顺序选择。

Proves:
- 只读取选中的配置文件，CLI 模型覆盖请求/配置，请求模型覆盖配置；doctor 的配置 timeout=99、CLI override=100 与默认 15000 均按独立预期核对。
