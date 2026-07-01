import paramiko
import sys

host = '43.139.43.112'
user = 'root'
key_path = r'D:\study1\DeepMindMap\v2\.secrets\deploy_key'

remote_cmd = '''
echo "=== 清空前 admin_ips 集合内容 ==="
mongosh "mongodb://127.0.0.1:27017/deepmindmap" --quiet --eval 'db.admin_ips.find().toArray()' 2>/dev/null | head -20
echo ""

echo "=== 清空 admin_ips 集合 ==="
mongosh "mongodb://127.0.0.1:27017/deepmindmap" --quiet --eval '
const result = db.admin_ips.deleteMany({});
print("删除数量: " + result.deletedCount);
print("剩余数量: " + db.admin_ips.countDocuments());
' 2>/dev/null
echo ""

echo "=== 重启后台服务 ==="
pm2 restart deepmindmap-admin --update-env
sleep 3
echo ""

echo "=== 验证健康检查 ==="
curl -s -w "\\nHTTP_CODE:%{http_code}" http://127.0.0.1:3002/api/health
echo ""

echo "=== 验证 dashboard 接口（不带 session，应放行）==="
curl -s -w "\\nHTTP_CODE:%{http_code}" http://127.0.0.1:3002/api/dashboard/stats
echo ""

echo "=== PM2 日志（最近5行）==="
pm2 logs deepmindmap-admin --lines 5 --nostream 2>&1 | tail -5
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
