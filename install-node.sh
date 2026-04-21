#!/bin/bash
# Node.js 安装脚本 - 适用于 OpenCloudOS

echo "开始安装 Node.js..."

# 下载 Node.js 20 LTS
NODE_VERSION="v20.12.2"
DOWNLOAD_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz"

cd /tmp
curl -fsSL "$DOWNLOAD_URL" -o node.tar.xz

# 解压到 /usr/local
tar -xJf node.tar.xz -C /usr/local/

# 创建软链接
ln -sf /usr/local/node-${NODE_VERSION}-linux-x64/bin/node /usr/local/bin/node
ln -sf /usr/local/node-${NODE_VERSION}-linux-x64/bin/npm /usr/local/bin/npm
ln -sf /usr/local/node-${NODE_VERSION}-linux-x64/bin/npx /usr/local/bin/npx

# 清理
cd /tmp
rm -f node.tar.xz

# 验证
echo "Node.js 安装完成！"
node -v
npm -v
