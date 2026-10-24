### Case VIDEO-RUN-HISTORY-001: 结构化运行记录不重复敏感正文

Tests:
- `test:47e684009431cf9c7363b0ac67f8878e85e4fa09d81b3e0e851803973206ecf6`
- `test:78af4c5a00ac803c9d781d1ac1fa479d1217d68dc9f94321abfcbbb2ccc62b26`
- `test:95edb9d2113008a4105018eb03f1fb377491f530f235835a5697e779ce3818a0`
- `test:fa615fc3feda3ce9aa648cd59bb674856fd43e2657acd18489c3090477399f97`

Tags:
- `video-understanding`

Contract:
- 运行记录保留 scope、状态、时间、动作安全参数与产物定位，不复制提示词或校正正文；最近保存记录不等于当前调用。

Proves:
- reuse/create/update/revoke 和失败/中断可回查；跨 scope、时间乱序或损坏记录被标记 invalid，纯读取不写日志且私密正文不出现在记录投影。
