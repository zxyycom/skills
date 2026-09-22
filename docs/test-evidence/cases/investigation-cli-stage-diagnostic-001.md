### Case INVESTIGATION-CLI-STAGE-DIAGNOSTIC-001: CLI stage preserves version-control diagnostic facts

Tests:
- `test:bb9c5998e4f22f451d05ce2d44e385f9cf72ad7d1edd80137b2b959d2194fe22`

Tags:
- `investigation-report`

Contract:
- `stage --scope index` 的最终 CLI renderer 必须保留 index runtime 给出的版本控制诊断 code、target、cause 和 operation，而不能压缩为普通错误字符串。

Proves:
- 非 Git fixture 返回退出码 1、stdout 为空，stderr 显示 repository-unavailable code、configured-root target、not-repository cause 和 operation。
