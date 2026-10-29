### Case SKILL-UPDATER-DEFER-AUTH-001: 凭据查询晚于本地校验且不影响无副作用入口

Tests:
- `test:382c14720491e751a2d24b1e70f01372b2ecb03e1e137509054293940e274fd2`
- `test:62ac9921b72151230fabd8b473719b0cea0e60fc62944b954e39ceba362762c0`
- `test:8217dbc671aaa3af1e5162527c2e3158691b4c81e18e17cfb2d17bd641dda555`

Tags:
- `skill-updater`

Contract:
- 普通 import 和 help 不查询 GitHub 凭据或访问网络；非 skill 目标必须在任何凭据查询之前被拒绝。

Proves:
- 真实 Node 进程导入公开入口成功且无输出；源码 CLI 的 help 返回 0，非 skill 目录以缺少 SKILL.md 的错误拒绝并保留原文件。三条路径的 gh 调用和请求记录均为空。
