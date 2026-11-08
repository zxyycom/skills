### Case INVESTIGATION-HISTORY-PAYLOAD-INTEGRITY-001: 无关历史 blob 损坏不阻断所选前序

Tests:
- `test:37d9787b9574a618d832c32f5b08aefec7839a092a6f760a0323de047671d989`

Tags:
- `investigation-report`

Contract:
- 无关历史 blob 不可用时，可信索引定位的必要前序仍应正常确认。

Proves:
- 真实 Git 中暂时移走未选 HEAD 源的 loose object 后，历史检查结果与完整时完全相同：已记录前序未产生未记录或 history unavailable warning；节点不计数对象读取。
