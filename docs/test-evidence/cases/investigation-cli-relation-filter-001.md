### Case INVESTIGATION-CLI-RELATION-FILTER-001: CLI rejects repeated relation query options

Tests:
- `test:e6e6ab428bcca846525e4ba0ed95e7a2b12e77fbc60e6ef739ef792965cc7bda`

Tags:
- `investigation-report`

Contract:
- `list` 与 `search` 的 `--related-to`、`--direction` 和 `--relation-type` 各只接受一次，重复参数不得被忽略或改变为无筛选查询。

Proves:
- 两个命令对每个重复关系查询参数返回参数错误、退出码 `2` 且不写 stdout。
