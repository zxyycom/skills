### Case VIDEO-ARTIFACT-FROZEN-INSTALL-001: 实际视频 zip 的独立依赖安装

Tests:
- `test:2d0474a25dfae2fc8d97b714efdc97ad6bb223c48b03207d05a842dbe5288eb3`

Tags:
- `video-understanding`

Contract:
- 实际分发 zip 不携带依赖或用户配置；无祖先依赖时，入口失败保留恢复说明且不隐式安装，显式 frozen 安装使用随包锁文件。

Proves:
- 显式选择的 zip 解压到仓库外中文空格路径，逐级确认祖先无 node_modules；未安装时原生 Node 非零退出且不创建依赖目录，独立 frozen 安装后 help 成功，锁文件字节与原 zip 一致。
