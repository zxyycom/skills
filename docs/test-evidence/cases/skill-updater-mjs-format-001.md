### Case SKILL-UPDATER-MJS-FORMAT-001: 自包含 MJS 入口可安装 TS 制品

Tests:
- `test:792d58d6461f210233cd198c2aa2f048f63ddea5758d1532154b9526259619da`

Tags:
- `skill-updater`

Contract:
- 更新协议只按正式 zip 内的普通路径覆盖文件，不依赖包内代码采用 MJS 还是 TS；未出现的旧入口和定制文件保持不变。

Proves:
- 临时构建的自包含 MJS 格式入口通过真实 CLI 安装完整 TS 包及锁文件，并保留自身旧入口与本地定制；不声称冻结历史 updater 实现。
