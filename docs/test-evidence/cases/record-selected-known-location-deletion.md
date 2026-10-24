### Case RECORD-SELECTED-KNOWN-LOCATION-DELETION-001: 已知位置缺失按删除且不发现未知移动

Tests:
- `test:ce5ee6138e0f6b1eb3da65e1b132a7d2f20c302d02beca6d8a778f71851e72d9`
- `test:fe178da5a4380287767574794068158e6a7a0794eb00d7321387c59173adb426`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- selected sync 只定位baseline已知路径；未知新selector无已读定位依据时失败，已知路径缺失按所选删除而不推断未知移动。

Proves:
- 未知新ID明确要求full sync，正式index字节不变。
- 将source移动至未知路径后只选旧ID会移除旧条目，未知位置文件原样保留，不声称重新发现该对象。
