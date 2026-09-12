### Case INVESTIGATION-CLI-DEFAULT-FORMED-AT-001: distributed CLI defaults omitted formedAt to current UTC

Tests:
- `test:59e66230166a9994bbbdae81c9e1dfa537ac6bb19a71f0af8bc1cf68cfa1ce23`

Tags:
- `investigation-report`

Contract:
- `new <name-or-id>` 的 `--formed-at` 是可选显式覆盖；省略时，分发 CLI 使用创建时的当前 UTC 秒生成候选时间与标准 ID。

Proves:
- `new --help` 区分 name-or-ID 输入，把 `--formed-at` 标为可选，并说明当前 UTC 默认值；缺参诊断不再要求该选项。
- Node 运行的分发 bundle 可在无 `--formed-at` 时创建候选，生成时间落在调用窗口内，且 ID 日期与该时间的 UTC 日期一致。
