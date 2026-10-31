### Case STATE-INDEX-FULL-READ-SAFETY-001: 完整索引同步安全采集持久文件

Tests:
- `test:f02208ccd53a59b855e591b03472b00d7d550971d8f2a6b214173712d56d8bfc`

Tags:
- `index-runtime`

Contract:
- 完整sync读取索引时拒绝file、root和nested父目录替换，不降低合法root symlink边界。

Proves:
- 在handle实际读取时分别替换文件和目录，只有一次读取，结果index-read-failed。
