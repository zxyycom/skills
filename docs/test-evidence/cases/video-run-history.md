### Case VIDEO-RUN-HISTORY-001: 结构化运行记录不重复敏感正文

Tests:
- `test:2c99d5f72746c834c4030918df2f1aa1cddebfb354a9826ac9822de96ef990c3`
- `test:9667b23b1f2470d594cad3637873e747ccac72e520f16691de032da907707113`
- `test:b9019dae1b5f6ec11725987565af63757526cb40da784d0e0c302b331a04f009`
- `test:cd9f1f91bab9c6106d3db97b36b6eefc6349c8a1d14747988db7dda59dd730d8`

Tags:
- `video-understanding`

Contract:
- 运行记录保留 scope、状态、时间、动作安全参数与产物定位，不复制提示词或校正正文；最近保存记录不等于当前调用。

Proves:
- reuse/create/update/revoke 和失败/中断可回查；跨 scope、时间乱序或损坏记录被标记 invalid，纯读取不写日志且私密正文不出现在记录投影。
