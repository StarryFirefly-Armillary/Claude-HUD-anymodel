# Claude-HUD-anymodel

Claude Code statusLine HUD — 在命令行中实时显示当前模型、上下文用量、Token 用量等信息。兼容任何第三方模型提供商。

## 效果

```
mimo-v2.5-pro[1M]  ctx 45.2% [███████░░░░░░░░]  89.2K/12.3K  $0.34  5h 22%
```

- 模型名称完整显示（不截断）
- 上下文窗口用量进度条（绿/黄/红三色预警）
- 输入/输出 Token 数
- 本次会话费用（USD）
- 5 小时速率限制用量

## 兼容性

适用于任何通过 Claude Code 使用的模型，包括：

| 提供商 | 示例模型 |
|--------|---------|
| Anthropic 官方 | claude-opus-4-7, claude-sonnet-4-6 |
| 第三方代理 | mimo-v2.5-pro, 自定义端点模型 |
| AWS Bedrock | claude-sonnet-4-6 (bedrock) |
| Google Vertex | claude-opus-4-7 (vertex) |

只要 Claude Code 的 `statusLine` API 返回标准 JSON，就能正常工作。

## 安装

### 方式一：一键安装

```bash
# 克隆仓库
git clone https://github.com/StarryFirefly-Armillary/Claude-HUD-anymodel.git
cd Claude-HUD-anymodel

# 运行安装脚本
bash setup.sh
```

### 方式二：手动安装

1. 将 `hud.js` 复制到 `~/.claude/` 目录：

```bash
cp hud.js ~/.claude/hud.js
```

2. 在 `~/.claude/settings.json` 中添加 `statusLine` 配置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"~/.claude/hud.js\""
  }
}
```

> Windows 用户请使用完整路径，如 `"node \"C:/Users/你的用户名/.claude/hud.js\""`

3. 重启 Claude Code。

## 显示项说明

| 项目 | 说明 | 颜色 |
|------|------|------|
| 模型名 | 当前使用的模型完整名称 | 默认 |
| ctx | 上下文窗口使用百分比 | <60% 绿 / 60-85% 黄 / >85% 红 |
| 进度条 | 15 格可视化进度 | 同上 |
| Token | 输入/输出 Token 数（K/M 缩写） | 默认 |
| $ | 本次会话累计费用 | 默认 |
| 5h | 5 小时速率限制使用百分比 | <70% 默认 / 70-90% 黄 / >90% 红 |

## 技术原理

利用 Claude Code 内置的 `statusLine` API：
- Claude Code 每 ~300ms 将会话状态 JSON 通过 stdin 传给配置的命令
- `hud.js` 读取 JSON，提取模型/Token/上下文等字段，渲染为带 ANSI 颜色的单行文本输出到 stdout
- 进程立即退出，无事件循环，无依赖

## 要求

- Node.js（任意版本）
- Claude Code CLI

## License

MIT
