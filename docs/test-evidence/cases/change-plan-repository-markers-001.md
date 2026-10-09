### Case CHANGE-PLAN-REPOSITORY-MARKERS-001: 拒绝不同表示的仓库入口

Tests:
- `test:640d5fea1744bf52a7c91c7ea210dbbd76fcacdc610843faa15a48f39d8c71ed`

Tags:
- `change-plan`
- `repository-boundary`

Contract:
- Change 根及其活动真实子目录中的任何 .git 入口或裸仓库布局都违反单一项目仓库边界，不依赖 Git 能否打开该入口。

Proves:
- 深层 .git 目录、gitfile、悬空符号链接及真实裸仓库均返回 change-root-contains-repository，指出违规目录，并使集合查询失败。
- Change 根自身的 .git 文件也被拒绝。
