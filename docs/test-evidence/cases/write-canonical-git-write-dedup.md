### Case WRITE-CANONICAL-CASE-004: 按字节合并对象写入并保留表示

Tests:
- `test:bbca60e944b036eb497bcdc607c2f72c283565db7b5b9f6cd05e8f79bbdf906c`

Tags:
- `write-canonical`

Contract:
- 相同字节在单次操作内复用对象写入，路径和 mode 保持。

Proves:
- 真实 Git 混合内容及文件表示核对对象启动数、并发峰值与结果。
