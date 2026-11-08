### Case DECISION-CLI-ACTIVATE-ALIGNMENT-001: Publish 要求 alignment 参数

Tests:
- `test:4c54b319cfd5f3f86ab21eb8099d63c88c1dd72f0996a55773184212f7ae8d17`

Tags:
- `decision-records`

Contract:
- Publish 必须由调用方显式提供建立后的 alignment。

Proves:
- 真实原生 CLI 的 publish 帮助公开 `--alignment aligned|unaligned`；缺少该选项时 JSON 报 `invalid-arguments`，显式提供时进入集合检查。该节点不单独断言退出码。
