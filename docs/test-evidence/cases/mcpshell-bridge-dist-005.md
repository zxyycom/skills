### Case MCPSHELL-BRIDGE-DIST-005: 分发忽略契约与真实入口 preview 可用

Tests:
- `test:436e52816055ca27756a9e8a0afc31d20074794312340818481ffcf8b97b9dc8`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- MCPShell 正式分发必须同时忽略安装目录与唯一 `/.env.mcpshell` 环境文件；公开 TS initializer 从自己的入口位置定位安装根。

Proves:
- 实际 skill 的生成 .gitignore 同时含 node_modules 与恰好一条环境规则；真实 Node 运行实际公开 initializer 的只读 preview 成功。
