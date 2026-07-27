### Case GENERATED-FILE-DRIFT-001: 生成文件检查识别真实漂移
Entry:
- `scripts/lib/generated-file.test.ts > generated file checks ignore line-ending differences and detect drift`
- `bun test --test-name-pattern="^generated file checks ignore line-ending differences and detect drift$" ./scripts/lib/generated-file.test.ts`
Contract:
- 生成文件检查应忽略纯换行差异并报告实质内容漂移。
Proves:
- 等价换行通过检查，内容变化返回漂移诊断。
