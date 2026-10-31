### Case RECORD-SET-RELATIONS-CLI-CLASSIFICATION-001: 两域 set-relations 对输入形态错误保持一致分类

Tests:
- `test:15ac9156e01214648d39296b1d8e631ab6abb2df16dfd58ea07aa4449145087c`
- `test:aeb4e6871c4523cbbb97f1b60129e316336738a39182b550e6b99ad8a5405964`
- `test:ba80654ae249ab8bf038ae420a27a4247ca5159c63cdd4c3afb11f198b5c8715`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- Decision 与 Investigation 的 `set-relations` 对重复 source、组内重复 target、空分组、clear 混用与只含摘要按 CLI 参数错误分类；公开语法只保留目标参数。

Proves:
- Decision 与 Investigation 的同进程 CLI 对重复 source、组内重复 target、空分组、clear 混用与只含摘要均返回退出码 2、用法诊断和空 stdout；不构造记录集合。
- set-relations help 只展示 `--source` 分组语法。
