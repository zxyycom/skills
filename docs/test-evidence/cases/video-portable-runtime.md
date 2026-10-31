### Case VIDEO-PORTABLE-RUNTIME-001: Node 与 Bun 独立运行完整分发入口

Tests:
- `test:7255b035c0d395aa4ec8140c1b4d12952d17481af3f07705db49c95dfc9aed91`
- `test:75ff7fd3bd4424326970daa08ce686fbe30d481b35b1a030c96120855b1bb47f`

Tags:
- `video-understanding`

Contract:
- 分发 TS 在显式提供兼容依赖后可从仓库外安装位置运行；读取、校正和纯复用不要求媒体环境。

Proves:
- 真实 Node/Bun 从无关 cwd 执行 help、read、prepare/frames 复用、refine 和 logs，非法参数有非零退出，包、原素材与用户配置目录不被改写。
