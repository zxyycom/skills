### Case INVESTIGATION-CANDIDATE-COMPLETE-LAYOUT-001: 候选准备消费发布 owner 声明

Tests:
- `test:b82d9ad0ae49d4d58275ed668cccca88bae9fe9349dc65c5e9e34e8e6b34dac9`

Tags:
- `investigation-report`

Contract:
- 候选资源 owner 的正式声明只来自合法发布索引，不为纯依赖读取正式正文。

Proves:
- 已有完整 layout 时仍读取发布索引；共享资源 ready，references 仅含所选候选和必要 owner，正式 owner 正文没有额外 readFile。
