### Case DECISION-STAGE-ARGV-SCOPE-WIRING-001: Stage 参数解析与 scope 接线保留调用方暂存字节

Tests:
- `test:d72eaec4ac757fd360c0ade4dfcb5083f1e22858afb914bbaecc4380c1b029f7`

Tags:
- `decision-records`

Contract:
- CLI 将带 Markdown 后缀的 name 与 scope 交给对应暂存行为。

Proves:
- 真实 CLI 的 record.MD index 步骤只暂存索引；domain 步骤暂存正文，保留索引字节和无关 pending，JSON 分别报告 index/domain。
