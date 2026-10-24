### Case VIDEO-HELP-ISOLATION-001: 帮助独立于配置且无数据副作用

Tests:
- `test:096465bb1b5b7559bdb6dcbb8104bb589775fb0bd4276408032369464f2faaf5`
- `test:b39272c44e16d5c94898ef390d95719ece5dd294b68f1c3135e6064b5a1c2c8e`

Tags:
- `video-understanding`

Contract:
- 真正的 --help 跳过配置读取且不创建运行数据；选项值中的 --help 不能绕过校验。

Proves:
- 内部 reader 未在 help 路径调用；Node 公开帮助可在损坏用户配置下成功，普通命令仍返回 arguments 失败且目录快照不变。
