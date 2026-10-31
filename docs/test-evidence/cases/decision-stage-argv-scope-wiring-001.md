### Case DECISION-STAGE-ARGV-SCOPE-WIRING-001: Stage 参数解析与 scope 接线保留调用方暂存字节

Tests:
- `test:1223577c6a08dbc18f78c7193aedb47c209f96125d3ba92e3f050b980d3bc8e9`

Tags:
- `decision-records`

Contract:
- Stage 的真实 CLI 将单个 Markdown 后缀 name selector 与 scope 交给对应暂存行为；domain scope 保留调用方已有的派生索引暂存内容。

Proves:
- 真实 Git fixture 中，带 .MD 后缀的 name selector 经 index scope 只暂存 decision-index.json，输出标明 index。
- 随后的 domain scope 将修改后的选定 Markdown 写入暂存区，输出标明 domain 与 caller-owned index 路径，原索引暂存字节保持不变。
