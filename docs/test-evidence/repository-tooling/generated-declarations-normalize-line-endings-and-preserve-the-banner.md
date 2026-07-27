### Case GENERATED-FILE-DECLARATION-001: 声明文件生成结果稳定
Entry:
- `scripts/lib/generated-file.test.ts > generated declarations normalize line endings and preserve the banner`
- `bun test --test-name-pattern="^generated declarations normalize line endings and preserve the banner$" ./scripts/lib/generated-file.test.ts`
Contract:
- 生成声明必须规范化换行，同时保留维护来源 banner。
Proves:
- 不同输入换行产生一致声明内容，且 banner 未被移除。
