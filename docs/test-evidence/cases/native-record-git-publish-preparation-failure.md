### Case NATIVE-RECORD-GIT-PREPARE-FAILURE-001: 对象准备失败与 index 边界

Tests:
- `test:48e1368e1f640b04123b4925fc997eb43489726aaf637987557ec61b94b97fd3`
- `test:d53286e7b91f3e09034c6b0f0a7f8f1e0a6b75af994af5d6028010e5f1ae8143`

Tags:
- `record-rust`

Contract:
- 对象准备失败时不得更新 index；并发准备完成已启动工作后按输入顺序报告首错，异常不能伪装成功。

Proves:
- 私有 Git 人为阻断对象写入并比较 index 字节；受控 worker 验证首错、工作收尾和 panic。
