### Case SKILL-UPDATER-INCOMPATIBLE-DEPENDENCIES-001: 不兼容依赖保留真实加载诊断

Tests:
- `test:e3fe0d8c1eacc17558d4d2c67f0ed4cca42cc98ea7be13c259b2b3910d85f0aa`

Tags:
- `skill-updater`

Contract:
- 正常模块解析取得的依赖若实际 API 不兼容，公开入口保留加载错误并提供恢复指引，不暗中覆盖宿主或安装依赖。

Proves:
- 以缺失所需 API 的依赖替身启动真实 TS updater，退出失败且保留函数不可用诊断和 frozen 指引，依赖文件保持原样。
