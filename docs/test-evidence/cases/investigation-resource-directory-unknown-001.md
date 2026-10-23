### Case INVESTIGATION-RESOURCE-DIRECTORY-UNKNOWN-001: 资源目录身份未知或被新建winner取代时保留现场

Tests:
- `test:030c707a640653d001635d01bfafb5e21e778457c66bbc5ec8af1dec93c96258`

Tags:
- `investigation-report`

Contract:
- 无法证明实际创建identity或当前不再匹配时，不递归删除、不误报完整回滚。

Proves:
- mkdir后identity采集失败以及chmod窗口外部同路径新建目录，两种情况均partial-or-unknown／changed，保留目标和winner字节，旧报告与index不被覆盖。
