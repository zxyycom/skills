### Case INVESTIGATION-RENAME-TARGET-001: 不一致或冲突 target 零写入失败

Tests:
- `test:1575d0c2030caddaecac64b963978c02dac4c40c345655edf344632a22eb49b7`

Tags:
- `investigation-report`

Contract:
- 显式 dated target 必须与 formedAt UTC 日期一致且 target ID 不得已存在；失败不得写入 source。

Proves:
- 日期不一致和已存在 target ID 都返回错误。
- 两类拒绝后 source Markdown 保持原字节。
