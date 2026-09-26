### Case INVESTIGATION-STAGE-SOURCE-PATH-REUSE-001: 身份更正共用文件位置时保留所选新报告

Tests:
- `test:7c1ad2abb52a8e3baeffe77a56db3d865aac2013557e1273ccaa4a6ef63b7985`
- `test:fb0823bfdbd037ff10b5a88940601f22e729cc006e1e9c77e7ff7ef5daa0a519`

Tags:
- `investigation-report`

Contract:
- 按[调查报告暂存契约](../../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)，`stage` 的 `all` 与 `domain` scope 同时选择身份更正的新旧 ID 时，工作区新 ID 的当前 `sourcePath` 优先于 `HEAD` 旧 ID 对同一路径的删除。

Proves:
- 对预先准备的新旧 ID 共用语义文件名、新 ID 字典序先于旧 ID 的状态，两种 scope 暂存均成功；共用路径表现为修改且内容声明新 ID。
- Git 暂存区没有额外报告路径，也不删除共用路径；此处验证的是 `stage` 的结果，不是 `rename` 身份更正事务。
