<div align="center">
<img src="image.png" width="128" />

# Antigravity Interface (AGI)

[English](README.md) · **简体中文**

[![Version](https://img.shields.io/visual-studio-marketplace/v/wang-muhan.antigravity-interface)](https://marketplace.visualstudio.com/items?itemName=wang-muhan.antigravity-interface)
[![GitHub stars](https://img.shields.io/github/stars/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface)
[![GitHub issues](https://img.shields.io/github/issues/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface/issues)
[![License](https://img.shields.io/github/license/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface/blob/main/LICENSE)

</div>

Antigravity 专属代理接口：通过安全路由绕过服务器防火墙，保障远程开发环境的连通性。

> **注意:** 此版本仅支持 **Linux 远程服务器**。

---

## 功能特性

- **自动代理配置**：自动部署 `mgraftcp` 并配置代理。
- **SSH 反向隧道**：通过 SSH 端口转发将流量路由到本地代理。
- **进程重定向**：自动拦截并重定向语言服务器进程。

## 快速开始

1. 在 **本地 Antigravity** 环境中安装 "Antigravity Interface" 插件。
2. 通过 Antigravity Remote - SSH 连接到您的远程 Linux 服务器。
3. 在 **远程服务器** 环境中再次安装该插件（可以在插件视图的 "SSH: [服务器名]" 分类下点击安装）。
4. 执行 **Developer: Reload Window** 命令（重新加载窗口）或重启 Antigravity，以确保代理服务正确初始化。
5. 在设置中配置 `localProxyPort`（例如 7890）以匹配您的本地代理软件。

## 扩展设置

| 设置 | 说明 |
|------|------|
| `enableLocalForwarding` | 启用 SSH 反向隧道转发。 |
| `localProxyPort` | 本地计算机上的代理端口。 |
| `remoteProxyHost` | 远程服务器上的代理主机地址。 |
| `remoteProxyPort` | 远程服务器上的代理端口。 |

## 环境要求

- 远程服务器的 SSH 访问权限。
- Linux 远程服务器（x86_64 或 arm64 架构）。
- 本地运行的代理软件（如 Clash、V2Ray）。
