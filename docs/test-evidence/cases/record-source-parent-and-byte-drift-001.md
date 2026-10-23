### Case RECORD-SOURCE-PARENT-AND-BYTE-DRIFT-001: 安全来源读取保留父链与字节漂移保护

Tests:
- `test:bb266a11d98701d6b5331cce989424a26a1eede4535a07fe2923d8523070eae3`

Tags:
- `record-operations`

Contract:
- 来源读取必须核对前后父链身份与打开句柄的字节稳定性；目标文件 inode 相同不足以证明读取安全。

Proves:
- 在 open 后分别替换集合根或 archive 父目录，并以 hardlink 保留目标 inode，读取均以读取期间变化失败；两种注入均确认已发生且目标 inode 不变。
- 在 handle.readFile 返回字节后追加正文，确认修改已发生且目标 inode 不变，读取仍以读取期间变化失败；该窗口不外推为所有并发修改或原子快照保证。
