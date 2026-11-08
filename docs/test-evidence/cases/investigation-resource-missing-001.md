### Case INVESTIGATION-RESOURCE-MISSING-001: 候选引用资源缺失阻断 readiness

Tests:
- `test:0deb551bad25d25b014365ae465bfcc4710bd89f634721cbc851376ef4643e24`

Tags:
- `investigation-report`

Contract:
- 候选报告引用的 owner 资源必须存在。

Proves:
- 真实文件存在时 resource readiness 成立；删除资源文件后 readiness 失败并报告缺失。
