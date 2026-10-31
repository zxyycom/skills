### Case LIGHTWEIGHT-JUDGMENT-CLI-025: 默认建库与路径解析

Tests:
- `test:5850da800489e3df97f161b370ec154da78f2b47422f4be22c356bac7125c3b5`

Tags:
- `lightweight-judgment`

Contract:
- 启用日志时缺失的默认数据库自动创建；相对路径以配置文件目录为基准，~/ 以用户目录为基准。

Proves:
- 仅配置 enabled=true 的调用自动创建用户数据目录下的库，保存成功状态和响应但不保存请求，POSIX 父目录权限为 0700。
- doctor 将相对路径与 ~/ 路径分别解析为预期绝对路径，但不创建这些文件。
