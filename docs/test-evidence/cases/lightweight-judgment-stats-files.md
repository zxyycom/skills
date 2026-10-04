### Case LIGHTWEIGHT-JUDGMENT-STATS-FILES-001: 私有普通文件与符号链接边界

Tests:
- `test:1d5eb0bc818d36be9975c4d2160e4ec8041a1205bbe73e53ba2b8edb119f8ead`

Tags:
- `lightweight-judgment`

Contract:
- 只读统计仅接收已有私有普通文件；不修改权限或符号链接目标。

Proves:
- POSIX 0644 与指向合法库的符号链接均退出4；原库字节与链接目标不变。
