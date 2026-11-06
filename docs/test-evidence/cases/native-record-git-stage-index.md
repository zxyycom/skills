### Case NATIVE-RECORD-GIT-STAGE-INDEX-001: 两域选定索引 stage 与错误诊断

Tests:
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`
- `test:a0f7e8d91d7cab17bf5ef5c757033826305a9f83f591226e2057905066410af4`
- `test:a4d0cf5c8886cb5e3a5992001f6ee81f852a86ec20e7ce081d95606b63f0220c`
- `test:a922ab01cf4dbcc8346297d66392fa2dd18a8caf226b9994394f524b9ff42f77`
- `test:de4754fb2181797d6515c24b87946c21f659cef97d8d9c8a3cefd4348fa056b3`
- `test:f865d470785377d6f27f940f73f67657e8230abfb6aaf2c02c83ab52df3271c3`

Tags:
- `record-rust`

Contract:
- 选择性 stage 必须以实际 HEAD/pending 为基线保留未选事实。

Proves:
- 真实 Git 分别验证选定投影、缺失或删除的 index、unborn 以及 selector 和 stale 源诊断。
