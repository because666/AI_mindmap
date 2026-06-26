import paramiko
import sys

HOST = '43.139.43.112'
USERNAME = 'root'
PASSWORD = '123456789Luo'


def run(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USERNAME, password=PASSWORD, timeout=30)
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    client.close()
    return out, err


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    ip = sys.argv[1] if len(sys.argv) > 1 else '39.144.218.156'
    cmd = f"""mongosh 'mongodb://deepmindmap:deepmindmap123@localhost:27017/deepmindmap?authSource=deepmindmap' --quiet --eval 'db.admin_ips.insertOne({{ ipAddress: "{ip}", nickname: "当前管理员", isFirstAdmin: false, isActive: true, loginCount: 0, createdAt: new Date(), lastLoginAt: new Date() }}); print("INSERTED");'"""
    out, err = run(cmd)
    print(out)
    if err:
        print('STDERR:', err, file=sys.stderr)
