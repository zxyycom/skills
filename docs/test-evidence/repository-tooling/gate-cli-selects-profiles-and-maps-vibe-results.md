### Case GATE-CLI-RESULT-001: CLI 只选择 default/full 并映射 Vibe 结果

Entry:
- `scripts/vibe-check.test.ts > CLI accepts only default and full, and maps Vibe results to exit codes`
- `bun test --test-name-pattern="^CLI accepts only default and full, and maps Vibe results to exit codes$" ./scripts/vibe-check.test.ts`

Contract:
- 权威入口只接受无参数的 default 或单独的 `--full`；未知参数在启动 Check 前退出失败，completed aggregate 与非 completed Vibe Result 都必须映射为稳定的非零退出和可行动诊断。

Proves:
- default/full 选择各自 Definition，未知参数给出 usage。
- failed aggregate 与 configuration 类 invocation failure 都返回退出码 1，并保留 Vibe 状态或类别而不重建 renderer。
