### Case INVESTIGATION-DISCARD-PENDING-001: discard preserves existing Git pending content

Tests:
- `test:677d2738772eea437f313e184832433de4db09fb323868a26cd6f465505711d9`

Tags:
- `investigation-report`

Contract:
- discard 只修改工作树，不得改变已有 Git pending 快照。

Proves:
- 真实 Git 仓库中删除已记录正式报告及资源后，cached binary diff 与完整 `ls-files --stage -z` 输出均与操作前相同。
