### Case INVESTIGATION-QUERY-STALENESS-001: CLI 区分快照查询与当前正文边界

Tests:
- `test:8003446d3824c4f6cce4f04fd3aae29e1b4db26552973b3a51769c7eab086ff5`

Tags:
- `investigation-report`

Contract:
- list、trace、metadata search 查询发布快照，不核对来源也不默认警告；show 的局部正文与 content 的当前来源分别表达自身边界。

Proves:
- 正文追加后 list、trace、metadata 成功且 stderr 为空，metadata 来源为 unchecked。
- show 输出当前正文并警告该条 metadata 快照边界；content 命中新正文并保留 fallback 来源 warning 与恢复指引。
