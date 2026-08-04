### Case VERSION-CONTROL-PENDING-PATHS-001: 拒绝非法 pending 替换路径且不产生写入
Entry:
- `tools/shared/tests/version-control.test.ts > rejects invalid pending replacement paths without changing pending files`
- `bun test --test-name-pattern="^rejects invalid pending replacement paths without changing pending files$" ./tools/shared/tests/version-control.test.ts`
Contract:
- pending 替换只接受合法字面仓库相对范围、范围内目标路径和规范化后唯一的精确文件集合。
Proves:
- 范围外目标、重复目标和越界范围均返回 `invalid-path`，完整 pending 快照保持不变。
