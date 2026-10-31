### Case INVESTIGATION-STAGE-SOURCE-PATH-DELETE-001: 依据 HEAD 索引位置暂存已删除报告

Tests:
- `test:584123487a402ef0827b0283408a891a6a9bc5122249b9b82378481bd1b6a8fe`
- `test:c9f2a5bc698eeba8be6991b8dcdab16848e93dd3a622e1cd3b28ce848657ad31`

Tags:
- `investigation-report`

Contract:
- 所选基线-only ID 可暂存删除；sourcePath 迁移时旧来源按 HEAD 索引位置删除，而非按 ID 拼接路径。

Proves:
- 真实 domain stage 删除基线-only 报告及其 owner 树，不携带未选报告。
- 另一个真实 sourcePath 迁移入口将非 ID 的旧路径删除、当前新路径新增，暂存差异不包含其他来源。
