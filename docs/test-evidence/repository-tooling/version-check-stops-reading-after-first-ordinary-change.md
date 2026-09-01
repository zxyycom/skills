### Case REPO-SKILL-HASH-005: Version check stops reading after the first ordinary change

Entry:
- `scripts/lib/skill-package-hash.test.ts > version checks stop reading baseline blobs after the first ordinary change`
- `bun test --test-name-pattern="^version checks stop reading baseline blobs after the first ordinary change$" ./scripts/lib/skill-package-hash.test.ts`

Contract:
- version gate 在当前内存 snapshot 中发现首个普通包内容变化后立即判定版本承载，不读取注入基线仓储中无关的后续 blob。

Proves:
- 当前内存 snapshot 的首个普通变化在未提升 metadata.version 时产生版本提升诊断。
- 注入基线仓储记录的读取路径证明后续无关 baseline blob 不会被读取。
