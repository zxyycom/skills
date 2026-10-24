### Case VIDEO-DEPENDENCY-RECOVERY-001: 依赖按 Node 解析并显式恢复

Tests:
- `test:1f02f20d86fa99940f5d0fb5ba40de1f30a61660f40eb17b62a6188a4dfaf995`
- `test:487772a7535242e67cfe1fe1d8295b88d3fd964ef0e651b4c638a85d07a8bcd3`
- `test:f4fd040bbb0ac255c1f697062c1ad91c0c2515521b6a10f6138075b365d77066`

Tags:
- `video-understanding`

Contract:
- 入口可复用兼容宿主依赖；缺失或实际不兼容时保留 loader 诊断并给出 frozen 安装恢复入口，运行/help 不隐式安装。

Proves:
- 隔离目录中的缺失/不兼容 fixture 返回可行动诊断且文件快照不变；兼容祖先依赖可启动而不创建包内 node_modules。
