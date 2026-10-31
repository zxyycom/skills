### Case INVESTIGATION-RESOURCE-DIRECTORY-UNKNOWN-001: 资源目录身份未知或被新建winner取代时保留现场

Tests:
- `test:de039a229fee5c23e517029279e85af2a95a472d0fd271b7203b5383a83648f3`

Tags:
- `investigation-report`

Contract:
- 无法证明实际创建identity或当前不再匹配时，不递归删除、不误报完整回滚。

Proves:
- mkdir后identity采集失败以及chmod窗口外部同路径新建目录，两种情况均partial-or-unknown／changed，保留目标和winner字节，旧报告与index不被覆盖。
