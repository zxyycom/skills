### Case GATE-RELEASE-VERSION-FAILURE-001: 准备、版本、打包失败或取消不能形成成功交付

Tests:
- `test:35bbd5ea3bc4ccb1baf57d7c762185360a488abd2d33a3bb5dce01d2d8458210`
- `test:cd6e5b12abd3c12a51604344970d80e5937088aef5e657ef04fcebac85f143d5`

Tags:
- `repository-tooling`

Contract:
- prepare unavailable、版本问题、pack 异常与发布取消都不能形成成功交付；准备或版本失败不得写入打包制品，版本问题以独立单行 Check message 呈现。

Proves:
- 版本未提升时 version failed、pack 不通过且 dist 不存在；版本诊断含主消息与详情，每条均无行分隔符；prepare 异常也阻断 pack。
- pack 异常使打包 Check failed；prepare 后触发取消时 Run 为 cancelled，pack 动作不执行。
