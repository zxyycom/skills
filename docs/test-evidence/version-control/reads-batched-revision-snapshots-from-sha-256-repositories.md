### Case VERSION-CONTROL-REVISION-SHA256-001: 批量读取 SHA-256 revision 快照

Entry:
- `tools/shared/tests/version-control.test.ts > reads batched revision snapshots from SHA-256 repositories`
- `bun test --test-name-pattern="^reads batched revision snapshots from SHA-256 repositories$" ./tools/shared/tests/version-control.test.ts`

Contract:
- `readRevisionFiles` 不把 Git revision 的对象标识格式限定为 SHA-1，并支持 SHA-256 repository。

Proves:
- 在支持 SHA-256 repository 的 Git 环境中，64 位 revision 返回正确的路径和字节。
