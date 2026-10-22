### Case INVESTIGATION-STAGE-EXECUTABLE-DRIFT-001: 阶段比较拒绝来源执行表示漂移

Tests:
- `test:74524745539c56b8de2ed650383d3a3ea3eeaade82f1b25963cfc5ed9f15e753`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 领域写计划比较同时覆盖来源字节与文件表示，相同字节不能掩盖 regular 到 executable 的变化。

Proves:
- POSIX 真实 domain stage 在准备阶段读取脚本后只改变执行位，独立复核再次读取相同字节并返回 source-drift；完整 pending 身份保持不变，工作区的新执行位保留。
