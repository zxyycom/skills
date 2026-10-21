### Case INVESTIGATION-STAGE-EXECUTABLE-DRIFT-001: 阶段比较拒绝来源执行表示漂移

Tests:
- `test:74524745539c56b8de2ed650383d3a3ea3eeaade82f1b25963cfc5ed9f15e753`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 领域写计划比较同时覆盖来源字节与文件表示，相同字节不能掩盖 regular 到 executable 的变化。

Proves:
- 相同采集被接受；保持路径与字节相同而只将 kind 从 regular 改为 executable 时，比较返回表示漂移。
