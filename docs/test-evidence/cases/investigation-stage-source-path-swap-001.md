### Case INVESTIGATION-STAGE-SOURCE-PATH-SWAP-001: 同选报告交换位置时保留两个当前版本

Tests:
- `test:34ac2102d7e8b84cd06c5b2c163acdca02c60de2c5c7060ada97a9ac3838901e`
- `test:5f00a7a9cb8bfa23d54bf366ff138c7067f07bc045f4daa4ff48007dcd0fdb06`

Tags:
- `investigation-report`

Contract:
- 按[调查报告暂存契约](../../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)，`stage` 的 `all` 与 `domain` scope 以所有所选 ID 在工作区调查索引中的当前 `sourcePath` 决定保留路径；这些路径不会因同时属于 `HEAD` 中的旧位置而被删除。

Proves:
- 两个稳定 ID 交换 `sourcePath` 并同步调查索引后，同时选择两个 ID 暂存；两条路径均表现为修改，并分别保存交换后的正确报告 ID。
- Git 暂存区没有额外报告路径或误删除；调查索引文件仅在 `all` scope 下产生暂存修改，在 `domain` scope 下保持基线字节。
