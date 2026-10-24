### Case RECORD-READER-SAFETY-001: 批量读取拒绝不安全路径和非法编码

Tests:
- `test:62f676ad990290523fbc9a6f0d44209960581b87dcf9c0926a1c7c5e7f400119`

Tags:
- `record-operations`

Contract:
- worker文件失败必须保留原读取诊断、原生错误类型和系统code；文件快照缺失仍绑定安全父链。

Proves:
- 缺失、symlink、父链别名、目录、越界与非法UTF-8的逐项诊断与异步读取一致，文本缺失保留ENOENT。
