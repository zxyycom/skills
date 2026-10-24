### Case VIDEO-PHYSICAL-INSTALLATION-001: 物理安装位置决定资源与包外边界

Tests:
- `test:3d4dc064bd1e9feb4ecfc5908133df5fc637ba7a2cc6bba472bb8702cb42f773`
- `test:fe309d1f3ce4f16ca785c58161947f7748ac9a375bd268d3c4ecdcc7c8a40506`

Tags:
- `video-understanding`

Contract:
- 公开入口 URL 决定安装资源位置；配置、运行根和数据根不得经直接路径或目录别名进入安装包。

Proves:
- junction 直接启动仍执行帮助；真实 Node 媒体边界读取物理包中的 runtime.env 与 media.py，配置/输出别名被拒绝且不写包内数据。
