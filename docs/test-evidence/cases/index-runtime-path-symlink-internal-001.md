### Case INDEX-RUNTIME-PATH-SYMLINK-INTERNAL-001: 在稳定符号链接布局中使用根内规范目标

Tests:
- `test:435c7b98ec38126b10856f2977ed09365d27d1e1acef5cdf6b1a9ed1db4c8c22`

Tags:
- `index-runtime`

Contract:
- 配置根目录自身或路径中的目录可以是符号链接，只要解析后的规范目标仍位于规范根目录内。

Proves:
- 符号链接根目录和根内目录符号链接两种稳定布局都把同步结果写入实际的根内目标。
- 两种布局随后都能从同一规范目标读取完整条目集合。
