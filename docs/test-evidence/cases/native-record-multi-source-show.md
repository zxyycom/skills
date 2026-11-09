### Case NATIVE-RECORD-MULTI-SOURCE-SHOW-001: 返回来源定位可定向回读重复 ID

Tests:
- `test:05dc785996bf06280ce358ee193cdaf74706c5789a5508aa9558e8336e629a6a`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 来源组查询返回的 root 与 investigationsDir 可用于原有 show 读取单一报告；show 不广播到组中其他来源。

Proves:
- 两源具有相同完整 ID、不同正文；分别传入 list 返回的定位参数后，真实 show 成功返回对应正文及单源结果形状。
