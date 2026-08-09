### Case INDEX-RUNTIME-PATH-SYMLINK-READ-001: 拒绝经符号链接逃逸的索引读取

Entry:
- `tools/index-runtime/tests/materialization.test.ts > rejects index reads through a symlink outside the configured root`
- `bun test --test-name-pattern="^rejects index reads through a symlink outside the configured root$" ./tools/index-runtime/tests/run.ts`

Contract:
- 索引读取必须依据规范路径约束在配置根目录内，不能跟随路径中的符号链接访问根目录外目标。

Proves:
- 指向根目录外的中间目录符号链接和最终文件符号链接都返回 `state-index.index-path-invalid`。
- 根目录外文件保持不变。
