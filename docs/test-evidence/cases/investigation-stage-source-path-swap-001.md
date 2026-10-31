### Case INVESTIGATION-STAGE-SOURCE-PATH-SWAP-001: 同选报告交换位置时保留两个当前版本

Tests:
- `test:efd882407a418664a3deed40aba8b4d8b4928a06b98d9b91b0d1785126c15a8c`

Tags:
- `investigation-report`

Contract:
- 按[调查报告暂存契约](../../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)，`stage` 的 `all` 与 `domain` scope 以所有所选 ID 在工作区调查索引中的当前 `sourcePath` 决定保留路径；这些路径不会因同时属于 `HEAD` 中的旧位置而被删除。

Proves:
- 两个稳定 ID 交换 `sourcePath` 并同步调查索引后，以 domain scope 同时选择两个 ID 暂存；两条路径均表现为修改，并分别保存交换后的正确报告 ID。
- Git 暂存区没有额外报告路径或误删除；调查索引在 domain scope 下保持基线字节。
