### Case INVESTIGATION-INDEX-INTEGRITY-001: 合法发布快照独立投影 list 结果

Tests:
- `test:04ecf9637bbe756343875f842d83e3d2cae8987718b8ed9bd0929aa2d60b3860`

Tags:
- `investigation-report`

Contract:
- 合法发布索引的 list 不读取报告源，不证明当前工作区来源合法或对齐。

Proves:
- 从合法内存索引投影得到既有报告 ID 和空 warnings；此入口不获取来源文件，也不验证文件权限。
