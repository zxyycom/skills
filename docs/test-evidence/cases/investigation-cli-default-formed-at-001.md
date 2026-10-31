### Case INVESTIGATION-CLI-DEFAULT-FORMED-AT-001: 源码 CLI 省略 formedAt 时使用当前 UTC 秒

Tests:
- `test:5f76184851b4930f21488623f5a65da1151391f64b30b191000bd901eacd3ab4`

Tags:
- `investigation-report`

Contract:
- `new <name-or-id>` 的 `--formed-at` 是可选显式覆盖；省略时，源码 CLI 使用创建时的当前 UTC 秒生成候选时间与标准 ID。

Proves:
- `new --help` 区分 name-or-ID 输入，把 `--formed-at` 标为可选，并说明当前 UTC 默认值；缺参诊断不再要求该选项。
- 同进程源码 CLI 可在无 `--formed-at` 时创建候选，生成时间落在调用窗口内，且 ID 日期与该时间的 UTC 日期一致。
