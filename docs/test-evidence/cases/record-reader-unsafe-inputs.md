### Case RECORD-READER-SAFETY-001: 批量读取拒绝不安全路径和非法编码

Tests:
- `test:189476500d9dbc00cc1f25e8c0efa3aee8618b233597efbef5a7f9e81f07c1e5`

Tags:
- `record-operations`

Contract:
- worker文件失败必须保留原读取诊断、原生错误类型和系统code；文件快照缺失仍绑定安全父链。

Proves:
- 缺失、symlink、父链别名、目录、越界与非法UTF-8的逐项诊断与异步读取一致，文本缺失保留ENOENT。
