### Case INVESTIGATION-STAGE-SOURCE-PATH-UPDATE-001: 暂存索引指向的报告而非同 ID 文件名下的其他报告

Tests:
- `test:2cf39b37168c3a0ef20c43d0c43ccd2758e9835269d1f75dff9c0cf39ee3bc7a`
- `test:ba2a155d3e8dec53646c6a597fe5567163afd208ced078b6b5d57fd22c7d53e2`

Tags:
- `investigation-report`

Contract:
- 按[调查报告暂存契约](../../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)，`stage` 的 `all` 与 `domain` scope 使用工作区调查索引中所选 ID 的 `sourcePath` 定位报告；文件名不决定身份，未选报告的 Git 暂存区字节保持不变。

Proves:
- 当 `<所选 ID>.md` 实际声明另一报告 ID 时，所选报告在其语义文件名下的更新成功进入 Git 暂存区。
- 未选报告的暂存内容与工作区内容不同时，操作保留原暂存字节，不用其工作区版本覆盖暂存内容。
