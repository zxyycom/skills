### Case LIGHTWEIGHT-JUDGMENT-CLI-004: 离线与凭据读取边界

Tests:
- `test:b736fd15d09affe5ba2b2be6dda72223725f8ef21481d13e36927bacd6931618`

Tags:
- `lightweight-judgment`

Contract:
- help 提供配置来源、离线试跑和错误出口，不读取配置、输入或凭据；dry-run 不读取环境密钥；doctor 离线报告密钥存在性。

Proves:
- 配置文件不可读且凭据读取被阻断时 help 仍退出 0、stderr 为空，并展示配置环境变量、自定义 endpoint、日志默认关闭与路径、文件 dry-run 示例、存储失败出口及完整契约位置。
- Proxy 阻断密钥读取时 dry-run 仍成功，缺密钥 doctor 返回 configuration/2 且不联网。
