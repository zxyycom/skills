### Case INVESTIGATION-STAGE-OWNER-DEPENDENCY-001: 资源 owner 是验证依赖而非写入目标

Tests:
- `test:1de304ad13f2065a23a62a9cbf6a14c6095928a84997421bd0325f6b09275499`

Tags:
- `investigation-report`

Contract:
- 直接共享资源的正式 owner 须验证，不自动扩大写入选择。

Proves:
- 真实领域 resolver 的 publication 选择仅含所选报告，而验证选择同时包含直接共享资源及正式 owner；malformed 无关报告不在显式来源读取范围。
- 按该选择显式读取真实 FS 正文并校验成功；owner 发布声明改变后领域验证拒绝，现场变更字节保留。
