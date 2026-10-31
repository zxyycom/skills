### Case INVESTIGATION-STAGE-SOURCE-PATH-UPDATE-001: 暂存索引指向的报告而非同 ID 文件名下的其他报告

Tests:
- `test:935d44ccbef8e89ab89a97fff9b2845a3118ecdcaa43ab0a1e495b63210d902a`

Tags:
- `investigation-report`

Contract:
- 按[调查报告暂存契约](../../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)，`stage` 的 `all` 与 `domain` scope 使用工作区调查索引中所选 ID 的 `sourcePath` 定位报告；文件名不决定身份，未选报告的 Git 暂存区字节保持不变。

Proves:
- 当 `<所选 ID>.md` 实际声明另一报告 ID 时，domain stage 将所选报告在其语义文件名下的更新写入 Git 暂存区。
- 未选报告的暂存内容与工作区内容不同时，操作保留原暂存字节，不用其工作区版本覆盖暂存内容。
