### Case GATE-CLI-RESULT-001: CLI 解析 default/full 与 full 基线并映射 Vibe 结果

Entry:
- `scripts/vibe-check.test.ts > CLI parses profiles and full baselines, then maps Vibe results to exit codes`
- `bun test --test-name-pattern="^CLI parses profiles and full baselines, then maps Vibe results to exit codes$" ./scripts/vibe-check.test.ts`

Contract:
- 权威入口只接受无参数的 default，或带可选 `--baseline-ref <ref>` 的 `--full`；full 缺省基线为 `HEAD`。显式基线必须非空、没有首尾空白、不以 `-` 开头且不含 NUL、CR 或 LF。未知、重复或未与 `--full` 组合的参数必须在启动 Check 前失败；completed aggregate 与非 completed Vibe Result 都必须映射为稳定的非零退出和可行动诊断。

Proves:
- default/full 选择各自 Definition，full 的显式基线原样传入 Definition；首尾空白、前导连字符及 NUL/CR/LF 输入与未知参数都在启动前给出 usage。
- failed aggregate 与 configuration 类 invocation failure 都返回退出码 1，并保留 Vibe 状态或类别而不重建 renderer。
