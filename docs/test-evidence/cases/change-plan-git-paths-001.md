### Case CHANGE-PLAN-GIT-PATHS-001: Git 距离按目录边界统计混合提交

Tests:
- `test:24d67923101d9486786bc1f2548250ae46bea9acb9d373ab68f3dab7984c2358`

Tags:
- `change-plan`

Contract:
- 同一提交同时修改当前 Change 与外部路径时，Git 距离计入该提交但只累计外部路径行数，名称相近的兄弟目录仍属于外部路径。

Proves:
- 混合提交被计为 1 个相关提交，当前目录的一行被排除，兄弟目录的两行被计入。
