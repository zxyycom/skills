### Case TASK-GRAPH-DISTRIBUTION-004: 不同 checkout 路径下制品字节可复现

Tests:
- `test:1e7b3db48fec225e1222ad5ca91bdaa58ff1c7ee087bf3ab08715b2d5abdb4fd`

Tags:
- `task-graph`

Contract:
- 当前生成制品不应携带 checkout 绝对路径；不同绝对路径构建需得到相同交付字节。

Proves:
- 两个不同路径的临时 checkout 实际 build 后，入口、声明与 runtime 全部字节相等；没有 ambient optional peer 有/无对照，不声称该边界。
