### Case INVESTIGATION-STAGE-EXECUTABLE-ONLY-001: 仅执行位变化参与暂存结果

Tests:
- `test:3091d0101f771e557f4851e8a7e1fc9c6f6f9c19745d582b6172176af8fd411b`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 执行位变化是暂存变化，相同内容与表示的重复暂存应报告 unchanged。

Proves:
- 相同字节的脚本从普通改为可执行后报告 changed 与脚本路径，Git 显示模式变化；重复执行无变化，再移除执行位又准确报告 changed 并写为 100644。
