### Case WRITE-CANONICAL-CASE-004: 按字节合并对象写入并保留表示

Tests:
- `test:82e63d067fd5d09fee4a756dd04bfee5895159e0b4044e4ff5f33bac8bc8aacd`

Tags:
- `write-canonical`

Contract:
- 相同字节在单次操作内复用对象写入，路径和 mode 保持。

Proves:
- 真实 Git 混合内容及文件表示核对对象启动数、并发峰值与结果。
