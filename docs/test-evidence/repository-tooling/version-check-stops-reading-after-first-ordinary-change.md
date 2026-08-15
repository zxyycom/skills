### Case REPO-SKILL-HASH-005: Version check stops reading after the first ordinary change

Entry:
- `scripts/lib/skill-package-hash.test.ts > version checks stop reading baseline blobs after the first ordinary change`
- `bun test --test-name-pattern="^version checks stop reading baseline blobs after the first ordinary change$" ./scripts/lib/skill-package-hash.test.ts`

Contract:
- version gate 在发现普通包内容变化后立即判定版本承载，不读取无关的后续基线 blob。

Proves:
- 首个普通 pending 变化在未提升 metadata.version 时产生版本提升诊断。
- 后续损坏但与该判定无关的基线 blob 不会阻断版本基线读取。
