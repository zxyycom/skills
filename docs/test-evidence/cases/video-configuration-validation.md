### Case VIDEO-CONFIGURATION-VALIDATION-001: 所有已读取配置严格校验

Tests:
- `test:8a99ad4687292d9c22794e386a7f669b2a0b6ec23be6f479b6bc34d63944c314`
- `test:bd2a641a525c260aa85c92dbb6a98088dc99ef78d55d71909f02fbebadf90da5`

Tags:
- `video-understanding`

Contract:
- 用户配置可缺失，显式项目配置必须存在；每个已读取文件必须是只含可选 appRoot/dataRoot 的 JSON 对象，值为绝对本地路径或 null。

Proves:
- 未知字段、非对象、类型和路径错误以及缺失项目文件在 arguments 阶段失败；更高层配置或 CLI 覆盖不能隐藏非法低层文件。
