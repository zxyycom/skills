### Case SKILL-UPDATER-UNVERSIONED-001: Check 报告未版本化安装

Tests:
- `test:0d8bfa1a830a5060e0303c5577fb38b57073be4f97b36be38d4ae7e58f02932c`

Tags:
- `skill-updater`

Contract:
- 缺少有效版本 metadata 的已安装 skill 必须被明确标记为 unversioned。

Proves:
- 真实需更新的 unversioned 安装经 --check 输出本地/远端版本比较；release/manifest 请求实际发生而 zip 请求为零。
- SKILL、custom 二进制和递归目录成员的前后完整字节/选集相等；这是 fixture 终态不变观察而非系统调用层零写证明。
