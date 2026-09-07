### Case CHANGE-PLAN-GIT-PATHS-001: Git 距离按目录边界统计混合提交

Tests:
- `test:b91662dca4bffc0a511b2fa565c1057b566906c30c36c0c661866be96b17cb71`

Tags:
- `change-plan`

Contract:
- 同一提交同时修改当前 Change 与外部路径时，Git 距离计入该提交但只累计外部路径行数，名称相近的兄弟目录仍属于外部路径。

Proves:
- 混合提交被计为 1 个相关提交，当前目录的一行被排除，兄弟目录的两行被计入。
