### Case VIDEO-HELP-ISOLATION-001: 帮助独立于配置且无数据副作用

Tests:
- `test:c9a89b47327e08c38706741ec1c17edd1455941b86801a2fa78fbc06bd21c616`
- `test:e360407197b9730344da6a2944e56e00a3ee8ec999c53fa2e2f7222ef2c2ff46`

Tags:
- `video-understanding`

Contract:
- 真正的 --help 跳过配置读取且不创建运行数据；选项值中的 --help 不能绕过校验。

Proves:
- 内部 reader 未在 help 路径调用；Node 公开帮助可在损坏用户配置下成功，普通命令仍返回 arguments 失败且目录快照不变。
