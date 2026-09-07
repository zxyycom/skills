### Case INVESTIGATION-CLI-RELATION-FILTER-001: CLI rejects repeated relation query options

Tests:
- `test:d90dc1376bdace24b842dd854c9131f5a6affafd23987524bdb2dc111898531a`

Tags:
- `investigation-report`

Contract:
- `list` 与 `search` 的 `--related-to`、`--direction` 和 `--relation-type` 各只接受一次，重复参数不得被忽略或改变为无筛选查询。

Proves:
- 两个命令对每个重复关系查询参数返回参数错误、退出码 `2` 且不写 stdout。
