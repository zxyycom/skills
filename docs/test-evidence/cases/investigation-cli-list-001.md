### Case INVESTIGATION-CLI-LIST-001: CLI list returns a current report after resource byte changes

Tests:
- `test:b18e63da2b7398025370b7fbda89c0e3c7b25b0cae120fccceccf53c3b42df8f`

Tags:
- `investigation-report`

Contract:
- 资源字节变化不使报告 index 过期，直接调用的源码 CLI 入口 `list` 继续可查询当前报告。

Proves:
- 在真实资源字节先后不同的 fixture 上，`list` 成功、stderr 为空且 stdout 返回紧凑报告定位行。
