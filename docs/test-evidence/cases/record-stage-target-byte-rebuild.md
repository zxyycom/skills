### Case RECORD-STAGE-TARGET-BYTE-REBUILD-001: 实际字节改变时重建确定性target

Tests:
- `test:0abb0949eb56cc9d97305194e9cb17eed5e2ff691571f70f53e61e40d4da7a61`
- `test:3fff421fdf07bf62874d191d9a60117633e92189a945f098921152f8c54dbb53`

Tags:
- `index-runtime`

Contract:
- 原始W字节不同即不满足target复用证明，即使解码或规范化投影仍相同。

Proves:
- index/all准备后给真实W添加BOM，两个阶段均真实读取W/P且各自build与serialize一次；按原投影语义保持正确pending与scope外。
