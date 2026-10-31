### Case DECISION-SYNC-INDEX-FILESYSTEM-DIAGNOSTIC-001: sync-index 保留结构化来源访问诊断

Tests:
- `test:94a2f56e24072f8e6d900f0c2c4223689c068fbcee92500a91e306d1d812f191`

Tags:
- `decision-records`

Contract:
- index-runtime 构建派生 Decision index 时的来源文件系统失败，必须以结构化 filesystem 事实进入 `sync-index`，保留 causeCategory 与受控 detail，不退化为普通未知错误。

Proves:
- 第二次来源读取注入 EACCES 后，CLI 失败且 stdout 为空，输出 sync-index failure、`access-denied` 和稳定 derived-index reason。
- detail 对 password 和绝对路径做净化，不含原始敏感值。
