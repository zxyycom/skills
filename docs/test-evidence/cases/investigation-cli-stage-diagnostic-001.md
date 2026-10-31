### Case INVESTIGATION-CLI-STAGE-DIAGNOSTIC-001: CLI stage preserves version-control diagnostic facts

Tests:
- `test:38b11f82c8bcbc4a0cc0d0a6634ff27e7e1a2637286bb989fed105826be70128`

Tags:
- `investigation-report`

Contract:
- `stage --scope index` 的最终 CLI renderer 必须保留 index runtime 给出的版本控制诊断 code、target、cause 和 operation，而不能压缩为普通错误字符串。

Proves:
- 非 Git fixture 返回退出码 1、stdout 为空，stderr 显示 repository-unavailable code、configured-root target、not-repository cause 和 operation。
