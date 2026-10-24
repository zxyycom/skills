### Case GATE-SECRET-CAPACITY-001: 项目密钥检测固定容量政策并扫描代表选集

Tests:
- `test:91bb565b8c277e409f2c37b0ef1e58194324618e68a70e9ef43a40f5e019b4b9`

Tags:
- `repository-tooling`

Contract:
- 项目密钥检测保留完整文本选集，以 5,120 文件、单文件 1 MiB 和总量 64 MiB 为有限容量；覆盖不足仍阻断，不以排除输入或 finding waiver 绕过。

Proves:
- 独立字面预期核对 5120 文件、单文件 1 MiB、总量 64 MiB 与空 finding waiver 配置。
- 三个真实 source/hooks/config 选集 smoke 均被选中扫描并给出预期结果。
