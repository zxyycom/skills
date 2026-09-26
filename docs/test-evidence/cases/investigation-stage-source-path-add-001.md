### Case INVESTIGATION-STAGE-SOURCE-PATH-ADD-001: 按索引位置暂存新增报告并按 ID 收集资源

Tests:
- `test:b176d50808c037beb1b1df13d97ebf36cdf15c1900c2570141d774e7ad4559ce`
- `test:e6797855a99105ef23be3248e7650865b9750ad5fae676baf4e974b4e03943ee`

Tags:
- `investigation-report`

Contract:
- 按[调查报告暂存契约](../../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)，`stage` 的 `all` 与 `domain` scope 使用工作区调查索引的 `sourcePath` 定位新增报告；该路径相对调查根目录，资源 owner 则由完整 Investigation ID 确定。

Proves:
- 文件名不同于 ID 的新增报告成功进入 Git 暂存区，内容声明所选 ID；`_resources/<完整 ID>/` 下的资源一并新增。
- 暂存差异仅包含所选报告和资源，以及 `all` scope 下的调查索引文件；`domain` scope 下调查索引没有暂存差异。
