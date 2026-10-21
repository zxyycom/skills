### Case INVESTIGATION-STAGE-SOURCE-PATH-DELETE-001: 依据 HEAD 索引位置暂存已删除报告

Tests:
- `test:2b80afe43b214f7bf66f8ce3feb93b9aa2d7f113bba14397c8caffdba3b971d2`
- `test:b0d558deb5cf8ac67b946dee9ada6aac3c7a6fe8d2bc1e6fc630898a4658097a`

Tags:
- `investigation-report`

Contract:
- 所选基线-only ID 可暂存删除；sourcePath 迁移时旧来源按 HEAD 索引位置删除，而非按 ID 拼接路径。

Proves:
- 真实 domain stage 删除基线-only 报告及其 owner 树，不携带未选报告。
- 另一个真实 sourcePath 迁移入口将非 ID 的旧路径删除、当前新路径新增，暂存差异不包含其他来源。
