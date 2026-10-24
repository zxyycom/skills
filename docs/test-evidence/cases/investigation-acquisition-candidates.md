### Case INVESTIGATION-ACQUISITION-CANDIDATES-001: 候选共享身份快照并消费索引 owner 声明

Tests:
- `test:45d8e4860f9d3f7f9ed09d491a2d52102797d1d488595c555289513e6d7ef930`

Tags:
- `investigation-report`

Contract:
- 同一候选操作复用候选来源与身份，正式资源 owner 只从合法发布索引取得声明。

Proves:
- 八条候选列表每份只读一次；show 有限枚举候选但没有正式正文读取，共享资源仍 ready。
