### Case RECORD-SEARCH-WARNING-001: 正常预览限制不要求修复当前来源

Tests:
- `test:ccd35ac719bbc7ba43a90eea3915880ef91c16268f79bc4bcc07e66e8da8d209`

Tags:
- `record-search`

Contract:
- 预览预算限制与来源恢复问题应分开报告。

Proves:
- DR 真实 CLI 在预览字符超预算时返回 preview-characters warning，warning 不要求 sync-index 或修复来源。
