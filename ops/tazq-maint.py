#!/usr/bin/env python3
"""
TAZQ sunucu bakimi (2026-11-06). Iki gorev, ikisi de cron'dan:

  status : 5 dakikada bir durumu olcer, /root/tazq-status/status.json'a yazar. Admin paneli ve e-posta uyarisi bunu okur.
  clean  : gecede bir YALNIZ yeniden uretilebilen seyi temizler.

GUVENLIK KURALI: yedeklere (/root/backups), Docker birimlerine (veritabani) ve calisan imajlara ASLA dokunulmaz.
`docker system prune` ve `docker volume prune` bu dosyada bilerek yok. Derleme suruyorsa temizlik atlanir.
Sir yazmaz: status.json'da yalniz sayi ve durum kodu vardir.
"""
import glob, json, os, re, shutil, subprocess, sys, time
from datetime import datetime, timezone

STATUS_DIR = '/root/tazq-status'
STATUS = f'{STATUS_DIR}/status.json'
HISTORY = f'{STATUS_DIR}/history.jsonl'
MAINT = f'{STATUS_DIR}/maint.json'
LOG = f'{STATUS_DIR}/maint.log'
BACKUPS = '/root/backups'
CONTAINERS = ['tazq-backend', 'tazq-db', 'tazq-redis', 'tazq-proxy']
CACHE_LIMIT_GB = 2.0
JOURNAL_LIMIT = '500M'
HISTORY_KEEP = 24 * 30


def run(*cmd, timeout=120):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout.strip()
    except Exception:
        return ''


def log(msg):
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(f"{datetime.now(timezone.utc).isoformat(timespec='seconds')} {msg}\n")


def cpu_pct():
    def sample():
        vals = list(map(int, open('/proc/stat').readline().split()[1:8]))
        return sum(vals), vals[3] + vals[4]
    t1, i1 = sample(); time.sleep(1); t2, i2 = sample()
    return round(100 * (1 - (i2 - i1) / max(1, t2 - t1)), 1)


def meminfo():
    m = {l.split(':')[0]: int(l.split()[1]) for l in open('/proc/meminfo')}
    total, avail = m['MemTotal'] // 1024, m['MemAvailable'] // 1024
    return {'totalMb': total, 'availableMb': avail, 'pct': round(100 * (total - avail) / total, 1)}


GB = {'b': 1 / 1024 ** 3, 'kb': 1 / 1024 ** 2, 'mb': 1 / 1024, 'gb': 1, 'tb': 1024}


def build_cache_gb():
    # docker builder du son satiri: "Total:  23.01GB"
    m = re.search(r'Total:\s*([\d.]+)\s*([kKmMgGtT]?[bB])', run('docker', 'builder', 'du'))
    return round(float(m.group(1)) * GB[m.group(2).lower()], 2) if m else 0.0


def journal_mb():
    m = re.search(r'([\d.]+)\s*([KMGT])', run('journalctl', '--disk-usage'))
    return round(float(m.group(1)) * {'K': 1 / 1024, 'M': 1, 'G': 1024, 'T': 1024 ** 2}[m.group(2)]) if m else 0


def containers():
    out = []
    for name in CONTAINERS:
        raw = run('docker', 'inspect', '-f', '{{.State.Status}}|{{.RestartCount}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}', name)
        p = raw.split('|') if raw else ['missing', '0', '']
        out.append({'name': name, 'status': p[0], 'restarts': int(p[1] or 0), 'health': p[2] if len(p) > 2 else ''})
    return out


def db_stats():
    user = run('docker', 'exec', 'tazq-db', 'printenv', 'POSTGRES_USER')
    db = run('docker', 'exec', 'tazq-db', 'printenv', 'POSTGRES_DB')
    raw = run('docker', 'exec', 'tazq-db', 'psql', '-U', user, '-d', db, '-At', '-c',
              "select pg_database_size(current_database()), (select count(*) from \"Users\" where \"DeletedAt\" is null), (select count(*) from pg_stat_activity), (select count(*) from \"Users\" where \"DeletedAt\" is null and \"LastActiveAt\" > now() - interval '1 day'), (select count(*) from \"Users\" where \"DeletedAt\" is null and \"LastActiveAt\" > now() - interval '5 minutes')")
    p = raw.split('|')
    if len(p) != 5:
        return {'sizeMb': None, 'users': None, 'connections': None, 'activeToday': None, 'activeNow': None}
    return {'sizeMb': round(int(p[0]) / 1024 ** 2, 1), 'users': int(p[1]), 'connections': int(p[2]), 'activeToday': int(p[3]), 'activeNow': int(p[4])}


# TAHMIN, yuk testi degil. Uc soru ayri: ayni anda kac kisi (islemci), kac kisinin verisi sigar (disk + bulut yedegi), ikisinden hangisi once biter.
CONCURRENT_PER_CORE = 250      # varsayim: oturumda kisi basi ~10 saniyede bir istek, cekirdek basina ~25 istek/sn rahat
PEAK_SHARE = 0.10              # varsayim: gunluk aktifin %10'u ayni anda
REGISTERED_PER_DAU = 5         # varsayim: kayitlinin %20'si her gun gelir
MB_PER_USER_MIN = 1.0          # olcum az veri goruyor: kullanici basina yillik buyumeyi kucumsememek icin taban
DISK_SHARE = 0.8
CLOUD_LIMIT_MB = 5 * 1024      # backup-db.sh MAX_TOTAL
CLOUD_COPIES = 30 + 12 + 12    # gunluk + haftalik + bir yillik aylik
THOUSAND = lambda n: int(round(n, -3)) or int(n)


def capacity(cores, free_gb, database, backup_mb):
    concurrent = cores * CONCURRENT_PER_CORE
    dau = int(concurrent / PEAK_SHARE)
    by_load = dau * REGISTERED_PER_DAU
    users = database.get('users') or 0
    per_user = max(MB_PER_USER_MIN, (database.get('sizeMb') or 0) / users) if users else MB_PER_USER_MIN
    by_disk = free_gb * DISK_SHARE * 1024 / per_user
    # Sunucudaki yedek sayisina degil, son yedegin kullanici basina boyutuna bakilir.
    per_user_backup = max(0.002, backup_mb / users) if users and backup_mb else 0.005
    by_cloud = CLOUD_LIMIT_MB / (per_user_backup * CLOUD_COPIES)
    by_data = min(by_disk, by_cloud)
    overall = min(by_load, by_data)
    return {
        'concurrentLimit': concurrent, 'dauLimit': dau, 'loadUsers': THOUSAND(by_load),
        'dataUsers': THOUSAND(by_data), 'dataLimitedBy': 'cloud' if by_cloud < by_disk else 'disk',
        'overallUsers': THOUSAND(overall), 'limitedBy': 'load' if by_load <= by_data else 'data',
    }


def backups():
    files = sorted(glob.glob(f'{BACKUPS}/tazqdb_*.dump'), key=os.path.getmtime)
    info = {'localCount': len(files), 'localMb': round(sum(os.path.getsize(f) for f in files) / 1024 ** 2, 1),
            'localLast': None, 'cloudLast': None, 'cloudProblem': None, 'lastMb': round(os.path.getsize(files[-1]) / 1024 ** 2, 3) if files else 0}
    if files:
        info['localLast'] = datetime.fromtimestamp(os.path.getmtime(files[-1]), timezone.utc).isoformat(timespec='seconds')
    try:
        lines = open(f'{BACKUPS}/backup.log', encoding='utf-8', errors='replace').readlines()[-400:]
    except OSError:
        lines = []
    for line in reversed(lines):
        stamp = line[:19]
        if 'BULUT OK' in line:
            info['cloudLast'] = datetime.strptime(stamp, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc).isoformat(timespec='seconds')
            break
        if not info['cloudProblem'] and ('BULUT HATA' in line or 'BULUT ATLANDI' in line):
            info['cloudProblem'] = 'skipped' if 'ATLANDI' in line else 'failed'
    return info


def age_hours(iso):
    if not iso:
        return None
    return (datetime.now(timezone.utc) - datetime.fromisoformat(iso)).total_seconds() / 3600


def days_to_full(free_gb, used_gb):
    """Son 7 gunun buyume hizindan tahmin. Temizlik sonrasi dusen kayitlar buyume sayilmaz."""
    try:
        rows = [json.loads(l) for l in open(HISTORY, encoding='utf-8')]
    except OSError:
        return None
    week = [r for r in rows if time.time() - r['t'] <= 7 * 86400]
    if len(week) < 24:
        return None
    grown = sum(max(0, b['used'] - a['used']) for a, b in zip(week, week[1:]))
    days = (week[-1]['t'] - week[0]['t']) / 86400
    rate = grown / days if days >= 1 else 0
    return round(free_gb / rate) if rate > 0.01 else None


def remember(used_gb, cpu, mem_pct, ok):
    try:
        rows = open(HISTORY, encoding='utf-8').readlines()
    except OSError:
        rows = []
    if rows and time.time() - json.loads(rows[-1])['t'] < 3500:
        return
    rows.append(json.dumps({'t': int(time.time()), 'used': used_gb, 'cpu': cpu, 'mem': mem_pct, 'ok': ok}) + '\n')
    with open(HISTORY + '.tmp', 'w', encoding='utf-8') as f:
        f.writelines(rows[-HISTORY_KEEP:])
    os.replace(HISTORY + '.tmp', HISTORY)


def warnings_of(s):
    w = []
    if s['disk']['pct'] >= 90: w.append('disk_critical')
    elif s['disk']['pct'] >= 80: w.append('disk_high')
    if s['memory']['pct'] >= 90: w.append('memory_high')
    if s['load']['one'] / max(1, s['load']['cores']) >= 1.5: w.append('cpu_high')
    if any(c['status'] != 'running' or c['health'] == 'unhealthy' for c in s['containers']): w.append('container_down')
    local, cloud = age_hours(s['backups']['localLast']), age_hours(s['backups']['cloudLast'])
    if local is None or local > 26: w.append('backup_late')
    if cloud is None or cloud > 26: w.append('cloud_backup_late')
    if s['backups']['cloudProblem'] == 'skipped': w.append('cloud_backup_skipped')
    days = s['disk']['daysToFull']
    if days is not None and days < 14: w.append('disk_filling')
    return w


def status():
    du = shutil.disk_usage('/')
    used, total, free = du.used / 1024 ** 3, du.total / 1024 ** 3, du.free / 1024 ** 3
    cpu = cpu_pct()
    mem = meminfo()
    load = os.getloadavg()
    try:
        maint = json.load(open(MAINT, encoding='utf-8'))
    except (OSError, ValueError):
        maint = None
    s = {
        'at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'load': {'cores': os.cpu_count(), 'one': round(load[0], 2), 'fifteen': round(load[2], 2), 'cpuPct': cpu},
        'memory': mem,
        'disk': {'totalGb': round(total, 1), 'usedGb': round(used, 1), 'freeGb': round(free, 1), 'pct': round(100 * used / total, 1), 'daysToFull': days_to_full(free, used)},
        'cache': {'buildGb': build_cache_gb(), 'journalMb': journal_mb()},
        'containers': containers(),
        'database': db_stats(),
        'backups': backups(),
        'maintenance': maint,
    }
    s['capacity'] = capacity(s['load']['cores'], s['disk']['freeGb'], s['database'], s['backups']['lastMb'])
    s['warnings'] = warnings_of(s)
    remember(round(used, 2), cpu, mem['pct'], not s['warnings'])
    try:
        rows = [json.loads(l) for l in open(HISTORY, encoding='utf-8')][-24:]
    except (OSError, ValueError):
        rows = []
    s['history'] = [{'t': r['t'], 'ok': r.get('ok', True)} for r in rows]
    with open(STATUS + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(s, f, ensure_ascii=False)
    os.chmod(STATUS + '.tmp', 0o644)
    os.replace(STATUS + '.tmp', STATUS)
    return s


def clean():
    before = shutil.disk_usage('/').free
    did = []
    # Derleme suruyorsa dokunma: deploy'u bozmayalim. Yalniz derleme onbellegi ve etiketsiz imajlar; calisan hicbir sey silinmez.
    building = run('pgrep', '-f', 'docker[ -]compose build|docker build|buildx')
    if building:
        log('atlandi: derleme suruyor')
        did.append('skipped_build_running')
    else:
        cache = build_cache_gb()
        if cache > CACHE_LIMIT_GB:
            run('docker', 'builder', 'prune', '-af', timeout=600)
            did.append('build_cache')
        run('docker', 'image', 'prune', '-f', timeout=300)
    run('journalctl', f'--vacuum-size={JOURNAL_LIMIT}')
    freed = round((shutil.disk_usage('/').free - before) / 1024 ** 2)
    state = {'at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'freedMb': freed, 'did': did}
    with open(MAINT + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(state, f)
    os.replace(MAINT + '.tmp', MAINT)
    log(f'temizlik: {freed} MB acildi {did}')
    return status()


if __name__ == '__main__':
    os.makedirs(STATUS_DIR, exist_ok=True)
    os.chmod(STATUS_DIR, 0o755)
    print(json.dumps((clean if sys.argv[1:] == ['clean'] else status)()))
