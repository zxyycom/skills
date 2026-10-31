### Case FILE-TEXT-SEARCH-SAFETY-001: 文件搜索拒绝不安全路径、链接和无效 UTF-8

Tests:
- `test:be1b3cb2ab6c24f0e7e7f48ade43c1f48d2dc92f5ebba61920be87366e389375`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索拒绝越出 root 的路径、符号链接和无效 UTF-8，且错误信息不暴露绝对搜索根。

Proves:
- 父目录路径、符号链接和损坏编码分别返回对应的结构化搜索错误。
- 符号链接错误文本不包含临时搜索根路径。
