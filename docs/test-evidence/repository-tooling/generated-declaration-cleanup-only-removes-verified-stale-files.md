### Case GENERATED-FILE-DECLARATION-CLEANUP-001: 声明树清理只移除已验证的过期文件

Entry:
- `scripts/lib/generated-file.test.ts > generated declaration cleanup only removes verified stale declaration files`
- `bun test --test-name-pattern="^generated declaration cleanup only removes verified stale declaration files$" ./scripts/lib/generated-file.test.ts`

Contract:
- 生成声明树只能清理不在当前闭包中、直接普通且带本生成器 header 的 `.d.mts` 文件；其他成员必须保留、报告手动处置并使构建失败。

Proves:
- check 报告可验证 stale 声明与不受支持成员；write 只删除 stale 声明，保留当前声明、手写声明、目录和符号链接，同时维持失败状态。
