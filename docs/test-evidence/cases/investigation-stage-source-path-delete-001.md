### Case INVESTIGATION-STAGE-SOURCE-PATH-DELETE-001: 依据 HEAD 索引位置暂存已删除报告

Tests:
- `test:35a573e14518b7fd0af66d13c0173f14bf65fdba714586fb08deddc88efb78e1`
- `test:aab8d04e867991d1edac54e97c672ffad63a98071694a91af02c2a764736f448`

Tags:
- `investigation-report`

Contract:
- 按[调查报告暂存契约](../../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)，所选 ID 已从工作区调查索引移除、但仍存在于 `HEAD` 调查索引时，`stage` 的 `all` 与 `domain` scope 使用 `HEAD` 中的 `sourcePath` 暂存报告删除。

Proves:
- 工作区删除语义文件名的报告并同步调查索引后，Git 暂存差异包含真实旧路径的删除，暂存区成员不再包含该路径。
- 未选报告没有暂存差异；调查索引文件仅在 `all` scope 下产生暂存修改，在 `domain` scope 下保持基线字节。
