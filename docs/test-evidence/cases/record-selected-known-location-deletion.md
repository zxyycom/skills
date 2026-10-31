### Case RECORD-SELECTED-KNOWN-LOCATION-DELETION-001: 已知位置缺失按删除且不发现未知移动

Tests:
- `test:32fdea0169626076e47f1a31a626f4b4e8bf75b6c2e51ff2dfce8554a64dfdcf`
- `test:7407040124314e6e92e6ee7a9b5e1c14c1405a447f0774fc39ca038da626f71f`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- selected sync 只定位baseline已知路径；未知新selector无已读定位依据时失败，已知路径缺失按所选删除而不推断未知移动。

Proves:
- 未知新ID明确要求full sync，正式index字节不变。
- 将source移动至未知路径后只选旧ID会移除旧条目，未知位置文件原样保留，不声称重新发现该对象。
