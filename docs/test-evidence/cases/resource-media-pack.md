### Case RESOURCE-MEDIA-PACK-001: 内容身份与图包顺序

Tests:
- `test:0d809c3df7e4655e477a433f310546d034a6a1adb5484f063db75d34a7c6a5b3`
- `test:4b08c58734716fc97ed8cc7e902e966adc1bca730c8c75e14fec120922fe37d2`

Tags:
- `resource-records`

Contract:
- 位置是内容声明而非媒体核验；图包按声明顺序固定精确资源版本，预览独立。

Proves:
- 缺失媒体路径不阻断文本查询，两个位置共享声明哈希；三帧版本顺序及指定成员目标可查询。
