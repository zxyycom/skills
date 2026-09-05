### Case FILE-TEXT-SEARCH-SAFETY-001: 文件搜索拒绝不安全路径、链接和无效 UTF-8

Entry:
- `tools/shared/tests/file-text-search.test.ts > rejects unsafe paths, symbolic links, and invalid UTF-8 without exposing root paths`
- `bun test --test-name-pattern="^rejects unsafe paths, symbolic links, and invalid UTF-8 without exposing root paths$" ./tools/shared/tests/file-text-search.test.ts`

Contract:
- 文件文本搜索拒绝越出 root 的路径、符号链接和无效 UTF-8，且错误信息不暴露绝对搜索根。

Proves:
- 父目录路径、符号链接和损坏编码分别返回对应的结构化搜索错误。
- 符号链接错误文本不包含临时搜索根路径。
