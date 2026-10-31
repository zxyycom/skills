### Case GATE-NATIVE-BUILD-CODE-001: 三类原生代码 Check 共用精确的构建源码例外

Tests:
- `test:a9d81906ecc15505ab2e81686da609ffc03a84da918020bdeb0510a212ad4bc6`

Tags:
- `repository-tooling`

Contract:
- duplicate-detection、file-metrics 与 function-metrics 的文件选择共同覆盖 scripts/build 维护源码及其普通子目录；该例外不能取消原生依赖、VCS、日志、缓存和产物排除，也不能扩展到近邻前缀目录。

Proves:
- 从真实三项 Check 读取文件策略，经 collectProjectFiles 扫描私有真实文件树；重复检测和文件指标恰好选中独立列出的产品、自动化及测试源码，函数指标三角色分别选中自身路径。
- 正样本包含 scripts/build 直接源码、测试及 nested/src 下源码；负样本包含 root 与 scripts/build 下的默认排除目录、generated 文件、技能副本、历史资源和再次嵌套 build。
- scripts-copy/build、scripts2/build、scripts/building/build、scripts/building/deep/build、scripts/buildish/build 与 scripts/builds/build 不因 micromatch 前缀语义而获得源码例外。
