### Case CHANGE-PLAN-ARCHIVE-SOURCE-001: 归档拒绝不安全源路径
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects unsafe source paths`
- `bun test --test-name-pattern="^archive rejects unsafe source paths$" ./tools/change-plan/tests/run.ts`
Contract:
- 归档源必须是受管理活动目录中的安全 change 路径。
Proves:
- 越界、别名或不受支持的源路径不会触发文件移动。
