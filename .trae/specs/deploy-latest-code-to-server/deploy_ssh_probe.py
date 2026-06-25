import paramiko
import sys

def run(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('43.139.43.112', username='root', password='123456789Luo', timeout=30)
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    client.close()
    return out, err

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'pwd'
    out, err = run(cmd)
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    print(out)
    if err:
        print('STDERR:', err, file=sys.stderr)
