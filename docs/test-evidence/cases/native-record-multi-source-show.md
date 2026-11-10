### Case NATIVE-RECORD-MULTI-SOURCE-SHOW-001: 返回来源定位可定向回读重复 ID

Tests:
- `test:05dc785996bf06280ce358ee193cdaf74706c5789a5508aa9558e8336e629a6a`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 来源查询返回的 root 与 investigationsDir 可显式定位 show 的单一集合，抑制默认 key 路由；该直接定位入口不广播到其他来源。

Proves:
- 两源具有相同完整 ID、不同正文；分别传入 list 返回的定位参数后，真实 show 成功返回对应正文及单源结果形状。
