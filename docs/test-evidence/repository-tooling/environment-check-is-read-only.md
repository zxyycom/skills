### Case ENV-CHECK-READONLY-001: 环境 check 只报告缺失的仓库配置
Entry:
- `scripts/environment.test.ts > environment check reports missing repository setup without writing it`
- `bun test --test-name-pattern="^environment check reports missing repository setup without writing it$" ./scripts/environment.test.ts`
Contract:
- `environment.js check` 只诊断环境与仓库配置，不能借检查写入 Git config 或文件 mode。
Proves:
- 缺失仓库 setup 时检查失败，并给出运行 `environment.js setup` 的行动诊断。
- 检查前后的仓库 local config 和 pre-commit mode 完全相同。
