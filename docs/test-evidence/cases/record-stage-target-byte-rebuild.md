### Case RECORD-STAGE-TARGET-BYTE-REBUILD-001: 实际字节改变时重建确定性target

Tests:
- `test:35099efe9c5d1a0762bb4d99a2ae2fc0d4813478fe337785b346eb7e1d74775b`
- `test:8233bb261406e0d3351a12cf69b7f0bd20d06d2691f8ccf4d687c64d6b27d3a2`

Tags:
- `index-runtime`

Contract:
- 原始W字节不同即不满足target复用证明，即使解码或规范化投影仍相同。

Proves:
- index/all准备后给真实W添加BOM，两个阶段均真实读取W/P且各自build与serialize一次；按原投影语义保持正确pending与scope外。
