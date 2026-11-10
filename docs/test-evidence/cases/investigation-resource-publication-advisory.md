### Case IR-RESOURCE-PUBLICATION-ADVISORY-001: 资源提示不改变发布及资源字节

Tests:
- `test:ca78fed5310a77fc8fbc62ee45e295f227239c07e8e91b524a71016a2fc43680`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 资源风险是只读提示，发布预检不写入，正式发布与后续局部／全量 check 仍遵守原有领域成功边界。

Proves:
- 真实 CLI 预检显示压缩提示且不建立报告；预检与正式发布均返回 1 项 warning 的分类计数，正式发布成功并保留资源字节，随后 selected 与 full check 均自动返回资源观察和提示。
