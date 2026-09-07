### Case INVESTIGATION-CLI-STAGE-DIAGNOSTIC-001: CLI stage-index preserves version-control diagnostic facts

Tests:
- `test:2e09b6188ae0a5ca704e09b0cfdabe1a491128ebe6d3c7eb8cc8b6082cf7ca4b`

Tags:
- `investigation-report`

Contract:
- `stage-index` 的最终 CLI renderer 必须保留 index runtime 给出的版本控制诊断 code、target、cause 和 operation，而不能压缩为普通错误字符串。

Proves:
- 非 Git fixture 返回退出码 1、stdout 为空，stderr 显示 repository-unavailable code、configured-root target、not-repository cause 和 operation。
