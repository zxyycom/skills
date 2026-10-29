### Case SKILL-UPDATER-ANONYMOUS-AUTH-001: 可选 CLI 凭据不可用时明确警告并匿名访问

Tests:
- `test:7f61912d85f9559acfa74ae2b793be799a3731e7dcfbb0019fd7557b6fe6ff5a`
- `test:9be65948bab77e385f54239691a800ee3e0855c32a470c86352baee771707360`
- `test:b5dcac47f247eb80dd6e2a2424e6c0745ef2a20f6c90e0dc0aa4370cafa367ff`
- `test:be6f3d888b5c7c5d576c7573783c2b60119d2527f966edff76215a6f3afa3813`
- `test:e673c090ede87015504c7d84ac3c10464d4984ce3f26ff66033097caa06d7aeb`

Tags:
- `skill-updater`

Contract:
- gh 缺失、执行失败、超时或输出为空白时不采用其输出作为凭据；明确警告共享 IP 限额和认证恢复方式，再匿名访问公开 release。

Proves:
- 源码认证入口把子进程替身返回的 ENOENT、非零状态、ETIMEDOUT 和空白输出分别归为可区分的匿名原因，不采用失败命令的凭据输出，也不自行输出诊断。
- 源码 CLI 在 gh 缺失时完成更新，release、manifest 和 zip 请求均无 Authorization；警告包含缺失原因、共享 IP 限额和登录命令，日志不含子进程原始输出，目标 SKILL.md 为远端正文。
- 子进程调用配置了 5 秒超时和非交互输入；超时结果由替身提供，不证明真实 gh 或操作系统的超时终止行为。
