### Case DECISION-SYNC-INDEX-FILESYSTEM-DIAGNOSTIC-001: sync-index 保留结构化来源访问诊断

Entry:
- `tools/decision-records/tests/filesystem-boundaries.test.ts > sync-index preserves structured source filesystem access diagnostics`
- `bun test --test-name-pattern="^sync-index preserves structured source filesystem access diagnostics$" ./tools/decision-records/tests/run.ts`

Contract:
- index-runtime 构建派生 Decision index 时的来源文件系统失败，必须以结构化 filesystem 事实进入 `sync-index`，保留 causeCategory 与受控 detail，不退化为普通未知错误。

Proves:
- 第二次来源读取注入 EACCES 后，CLI 失败且 stdout 为空，输出 sync-index failure、`access-denied` 和稳定 derived-index reason。
- detail 对 password 和绝对路径做净化，不含原始敏感值。
