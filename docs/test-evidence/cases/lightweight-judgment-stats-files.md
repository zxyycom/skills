### Case LIGHTWEIGHT-JUDGMENT-STATS-FILES-001: 私有普通文件与符号链接边界

Tests:
- `test:dee3b4f533c917661b24af86aa6e0aab7b7d551b6c40446f5a5acb91eac2c152`

Tags:
- `lightweight-judgment`

Contract:
- 只读统计仅接收已有私有普通文件；不修改权限或符号链接目标。

Proves:
- POSIX 0644 与指向合法库的符号链接均退出4；原库字节与链接目标不变。
