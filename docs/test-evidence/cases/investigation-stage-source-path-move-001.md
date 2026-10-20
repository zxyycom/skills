### Case INVESTIGATION-STAGE-SOURCE-PATH-MOVE-001: 同一报告移动位置时同时暂存旧路径删除与新路径新增

Tests:
- `test:b0d558deb5cf8ac67b946dee9ada6aac3c7a6fe8d2bc1e6fc630898a4658097a`

Tags:
- `investigation-report`

Contract:
- 按[调查报告暂存契约](../../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)，`sourcePath` 变化不改变 Investigation ID；`stage` 的 `all` 与 `domain` scope 选择该 ID 后，使用 `HEAD` 调查索引的旧路径和工作区调查索引的新路径构造暂存结果。

Proves:
- 只把报告从语义文件名移动至完整 ID 文件名并同步调查索引后，domain stage 的 Git 暂存差异同时包含旧路径删除与新路径新增；新路径保存移动前的完整报告内容。
- 调查索引在 domain scope 下保持基线字节；不会只暂存新文件而遗留旧文件。
