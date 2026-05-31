#!/bin/bash
set -e

echo "=== DeepMindMap V2 部署脚本 ==="
echo ""

PROJECT_DIR="/www/wwwroot/AI_mindmap"

cd "$PROJECT_DIR"

echo "[1/6] 拉取最新代码..."
git fetch origin
git reset --hard origin/main
echo "当前版本: $(git log --oneline -1)"

echo ""
echo "[2/6] 配置 ZHIPU_API_KEY_2..."
if grep -q "ZHIPU_API_KEY_2" server/.env 2>/dev/null; then
  sed -i 's/^ZHIPU_API_KEY_2=.*/ZHIPU_API_KEY_2=bedc2fe3985941588678ca54d5a6777e.IHuDsYES1XqBtBPM/' server/.env
else
  echo "" >> server/.env
  echo "ZHIPU_API_KEY_2=bedc2fe3985941588678ca54d5a6777e.IHuDsYES1XqBtBPM" >> server/.env
fi
echo "ZHIPU_API_KEY_2 已配置"

echo ""
echo "[3/6] 安装服务端依赖..."
cd server
npm install --production 2>/dev/null || npm install
echo "服务端依赖安装完成"

echo ""
echo "[4/6] 构建服务端..."
npm run build 2>/dev/null || npx tsc
echo "服务端构建完成"

echo ""
echo "[5/6] 构建客户端..."
cd "$PROJECT_DIR/client"
npm install 2>/dev/null
npm run build
echo "客户端构建完成"

echo ""
echo "[6/6] 重启服务..."
cd "$PROJECT_DIR"
pm2 restart deepmindmap-server
pm2 restart deepmindmap-admin 2>/dev/null || true
pm2 save
echo "服务重启完成"

echo ""
echo "=== 部署完成 ==="
echo "服务状态:"
pm2 list
echo ""
echo "请访问网站验证功能是否正常"
