### Case VIDEO-DEPENDENCY-RECOVERY-001: 依赖按 Node 解析并显式恢复

Tests:
- `test:21082bdbc8c073ea7713f99ba85c0d001b0d17a5a0e4d330abac1c0b05058833`
- `test:3c466812ef174a498ca84297e13b2a4389020c1d62cf93493c31d3afe3d0a0b0`
- `test:98a9326333254791e7637ee62d2f05d017630b29e11b7a019fa3c714542362ee`

Tags:
- `video-understanding`

Contract:
- 入口可复用兼容宿主依赖；缺失或实际不兼容时保留 loader 诊断并给出 frozen 安装恢复入口，运行/help 不隐式安装。

Proves:
- 测试自建的依赖入口文件缺失或导出不兼容时返回可行动诊断且文件快照不变，不依赖机器祖先目录是否安装依赖；兼容祖先依赖可启动而不创建包内 node_modules。
