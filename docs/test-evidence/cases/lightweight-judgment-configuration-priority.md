### Case LIGHTWEIGHT-JUDGMENT-CLI-003: 配置与覆盖优先级

Tests:
- `test:8a2fe20c757f5afc123774e60e0a0ca8662e98b78c7c8e64444190add7237ffc`

Tags:
- `lightweight-judgment`

Contract:
- 显式配置优先环境选择，不跨文件合并；模型依 CLI、请求、配置顺序选择。

Proves:
- 只读取被选择的配置文件，CLI 模型覆盖请求与配置，后续请求模型覆盖配置；doctor 的单次超时覆盖为 100 ms，缺省超时保持 15000 ms。
