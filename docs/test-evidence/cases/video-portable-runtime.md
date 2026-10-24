### Case VIDEO-PORTABLE-RUNTIME-001: Node 与 Bun 独立运行完整分发入口

Tests:
- `test:6fc0f4fd577195ea9c42e66f58c13cb19c9c3ff17cfedf002bd38b102e8d2ccf`
- `test:f594ea68442d8566ae6aa38625845436e0afd1a4be36b3677f2218d9633e962e`

Tags:
- `video-understanding`

Contract:
- 分发 TS 在显式提供兼容依赖后可从仓库外安装位置运行；读取、校正和纯复用不要求媒体环境。

Proves:
- 真实 Node/Bun 从无关 cwd 执行 help、read、prepare/frames 复用、refine 和 logs，非法参数有非零退出，包、原素材与用户配置目录不被改写。
