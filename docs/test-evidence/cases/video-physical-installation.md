### Case VIDEO-PHYSICAL-INSTALLATION-001: 物理安装位置决定资源与包外边界

Tests:
- `test:0f00b21280f1c8d811252bf7c4c46007c84b3928313d63c1c8b7d9a5b803136d`
- `test:a74fd2bfcebf4a5f64a60ffcedc05cfabf502e983910ff8b223954041b15a322`

Tags:
- `video-understanding`

Contract:
- 公开入口 URL 决定安装资源位置；配置、运行根和数据根不得经直接路径或目录别名进入安装包。

Proves:
- junction 直接启动仍执行帮助；真实 Node 媒体边界读取物理包中的 runtime.env 与 media.py，配置/输出别名被拒绝且不写包内数据。
