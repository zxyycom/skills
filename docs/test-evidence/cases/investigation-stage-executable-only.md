### Case INVESTIGATION-STAGE-EXECUTABLE-ONLY-001: 仅执行位变化参与暂存结果

Tests:
- `test:8b2ecd385dbf799cd8f026f8b5fd8f5a04c377d37a5bcf3afe09c04e3e15fbc0`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 执行位变化是暂存变化，相同内容与表示的重复暂存应报告 unchanged。

Proves:
- 相同字节的脚本从普通改为可执行后报告 changed 与脚本路径，Git 显示模式变化；重复执行无变化，再移除执行位又准确报告 changed 并写为 100644。
