### Case INVESTIGATION-CANDIDATE-COMPLETE-LAYOUT-001: 候选准备消费发布 owner 声明

Tests:
- `test:0a11415296d2048aa1132670418da34a76c6322b60706f4109aaba8133e73083`

Tags:
- `investigation-report`

Contract:
- 候选资源 owner 的正式声明只来自合法发布索引，不为纯依赖读取正式正文。

Proves:
- 已有完整 layout 时仍读取发布索引；共享资源 ready，references 仅含所选候选和必要 owner，正式 owner 正文没有额外 readFile。
