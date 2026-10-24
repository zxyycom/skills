### Case STATE-INDEX-FULL-READ-SAFETY-001: 完整索引同步安全采集持久文件

Tests:
- `test:261f41bed93bc5f19772857bdbbd6a475f7ea6e39dfb8e29020fd8d24eda22d6`

Tags:
- `index-runtime`

Contract:
- 完整sync读取索引时拒绝file、root和nested父目录替换，不降低合法root symlink边界。

Proves:
- 在handle实际读取时分别替换文件和目录，只有一次读取，结果index-read-failed。
