import paramiko
import sys

host = '43.139.43.112'
user = 'root'
key_path = r'D:\study1\DeepMindMap\v2\.secrets\deploy_key'

remote_cmd = '''
echo "=== PM2 状态 ==="
pm2 list | grep -E "deepmindmap|name|status"
echo ""

echo "=== 后台健康检查 ==="
curl -s -w "\\nHTTP_CODE:%{http_code}" http://127.0.0.1:3002/api/health
echo ""

echo "=== 后台 PM2 日志（最近30行）==="
pm2 logs deepmindmap-admin --lines 30 --nostream 2>&1 | tail -30
echo ""

echo "=== 检查 ipWhitelist.js 内容 ==="
grep -n "sessionId" /www/wwwroot/AI_mindmap/admin/server/dist/middleware/ipWhitelist.js
echo ""

echo "=== 检查 session 中间件配置 ==="
grep -n "session" /www/wwwroot/AI_mindmap/admin/server/dist/index.js | head -10
echo ""

echo "=== 检查 .env 文件 ==="
ls -la /www/wwwroot/AI_mindmap/admin/server/.env 2>/dev/null && echo ".env 存在" || echo ".env 不存在"
echo ""

echo "=== 检查 node_modules ==="
ls -d /www/wwwroot/AI_mindmap/admin/server/node_modules 2>/dev/null && echo "node_modules 存在" || echo "node_modules 不存在"
echo ""

echo "=== 测试 dashboard 接口（不带 session）==="
curl -s -w "\\nHTTP_CODE:%{http_code}" http://127.0.0.1:3002/api/dashboard/stats
echo ""

echo "DONE"
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(host, username=user, key_filename=key_path, timeout=30)
    stdin, stdout, stderr = client.exec_command(remote_cmd, timeout=60)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print(out)
    if err:
        print('STDERR:', err, file=sys.stderr)
finally:
    client.close()
