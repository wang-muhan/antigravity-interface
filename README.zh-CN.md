<div align="center">
<img src="image.png" width="128" />

# Antigravity Interface (AGI)

[English](README.md) · **简体中文**

[![Version](https://img.shields.io/visual-studio-marketplace/v/wang-muhan.antigravity-interface)](https://marketplace.visualstudio.com/items?itemName=wang-muhan.antigravity-interface)
[![GitHub stars](https://img.shields.io/github/stars/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface)
[![GitHub issues](https://img.shields.io/github/issues/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface/issues)
[![License](https://img.shields.io/github/license/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface/blob/main/LICENSE)

</div>

轻松解决 Antigravity 远程服务器的连接问题。此扩展通过将 Antigravity 的流量安全地路由到您的本地计算机或指定的服务器网关，确保您的远程编程工具可以绑过服务器防火墙。

> **注意:** 此版本仅支持 **Linux 远程服务器**。

---

## 功能特性

- **自动代理配置**：自动部署 `mgraftcp` 并配置代理。
- **SSH 反向隧道**：通过 SSH 端口转发将流量路由到本地代理。
- **进程重定向**：自动拦截并重定向语言服务器进程。

## 快速开始

1. 在 VS Code 中安装此扩展。
2. 在设置中配置本地代理端口（例如 Clash 的 7890 端口）。
3. 通过 SSH 连接到远程 Linux 服务器。
4. 扩展将自动设置代理隧道。

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
