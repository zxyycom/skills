### Case VIDEO-CONFIGURATION-VALIDATION-001: 所有已读取配置严格校验

Tests:
- `test:212ad707393dadc49ab18680fe65897a5c7f774874eeeb802cbe8b86052ff7c1`
- `test:a758ad1c30a0c75cd4acbb57b5babf2e00c731290a6d421c0ea6da9cf34ecd51`

Tags:
- `video-understanding`

Contract:
- 用户配置可缺失，显式项目配置必须存在；每个已读取文件必须是只含可选 appRoot/dataRoot 的 JSON 对象，值为绝对本地路径或 null。

Proves:
- 未知字段、非对象、类型和路径错误以及缺失项目文件在 arguments 阶段失败；更高层配置或 CLI 覆盖不能隐藏非法低层文件。
