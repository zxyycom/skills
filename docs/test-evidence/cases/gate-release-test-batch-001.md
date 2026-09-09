### Case GATE-RELEASE-TEST-BATCH-001: Release 测试批次按文件并集执行并投影 Check 结果

Tests:
- `test:1ab433b968b1b64ad72e1cfec079caede6dd4c374ef31465b121bc73070068c9`
- `test:873cf012fe20b1369890c5764454b78a3a7ae871963ddf9ee8aedf6c7ba8eefc`
- `test:b7d701a5e856e4f09efd649a7889a4afc155e674e95657cb9adf846990f28539`

Tags:
- `repository-tooling`

Contract:
- Release Gate 中无前置依赖的 Bun 测试 Check 共享一个最多四进程的固定分区 worker pool；重复文件只进入一个分区并执行一次，原 Check 仍分别结算自己的通过、失败与 transcript。

Proves:
- 两个共享同一文件的合成 Check 只形成一个不重复的文件并集，三个唯一文件各进入一次分区命令；各分区 JUnit 中通过和失败的 suite 分别投影为对应 Check 的退出状态，leader 汇总 worker transcript，投影 Check 写入共享定位。
- JUnit 未覆盖请求文件时返回可定位报告路径的 unavailable；worker 非零退出却只报告通过 suite 时同样拒绝把进程异常映射为合法测试结果。
