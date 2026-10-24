### Case VIDEO-EVIDENCE-LOCATION-001: 规范素材路径决定集合身份

Tests:
- `test:3b033040961ad56073ce537875e1c899464473c99ae81bf13723cd1589feeab7`
- `test:5a5ba5345c70d6f2cb8d263ba8849e96edf5d1af4d7f1c9d6bb2faef7e6f8269`
- `test:79dbd8ca435b8261d2af983576599b0fdf627e5ffac8573e3d12de4fea54302e`

Tags:
- `video-understanding`

Contract:
- 集合叶目录以素材 realpath 的摘要识别，不依赖 cwd；显式 output 为单视频覆盖，附带 input 仍须核对身份。

Proves:
- 路径别名和 Windows 大小写指向相同 scope，另一素材路径分离；纯读不建目录，写入只创建所选 scope，错误 input 不被静默忽略。
