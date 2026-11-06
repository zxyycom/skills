### Case NATIVE-RECORD-GIT-STAGE-DECISION-001: 决策正文及删除的选择性 stage

Tests:
- `test:1c81fd1c344d203bf10a8b6983429ce15c17ba203f24287b3e715509409a24d5`
- `test:1cef7b2435f54305b487ac49017309de51a2be8b1bb7fe45f715c6ddbf20f387`
- `test:2bebe4b041eaae3a3f10f3b2ee22917e6595955f1bd7e012d03aa780ece454ea`
- `test:64cb075bde1bd43f9cd98895478d08477bfbb37eda788e461cb698051b786154`
- `test:964e255edf614465843bd9de4c850235cb8ccb35d91e9c1823456591a1b8bf39`

Tags:
- `record-rust`

Contract:
- 决策 stage 只能更新选择的正文和索引相关路径。

Proves:
- 真实 Git 对照不同 HEAD、pending 和工作树，验证正文、删除、旧路径及无关 pending。
