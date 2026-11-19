#!/bin/bash
# rat-backup-pull.sh: pull oci's nightly rat DB dumps (huey:~/backups/rat/db) to this PC,
# the off-host copy. oci keeps 14 days; this keeps KEEP_DAYS. Missed days catch up on the next run
# (anything oci still holds and we lack is fetched). Each new file is checked against oci's sha256.
# Then: encrypts the last DRIVE_KEEP_DAYS of dumps (gpg AES-256, passphrase file below) and mirrors
# them to blueairblob's Google Drive (I:, via Windows robocopy; WSL cannot see the Drive mount).
# Each .gpg is test-decrypted against the dump's sha256 before it is uploaded.
# Scheduled from Windows Task Scheduler (task "RAT backup pull"), daily plus at logon.
set -euo pipefail
SRC="huey:backups/rat/db/"
DEST="/mnt/d/backups/rat_oci/db"
KEEP_DAYS=60
LOG="/mnt/d/backups/rat_oci/pull.log"
ENC="/mnt/d/backups/rat_oci/drive_enc"          # encrypted staging, mirrored to Drive
ENC_WIN='D:\backups\rat_oci\drive_enc'
DRIVE_WIN='I:\My Drive\RAT backups'
DRIVE_KEEP_DAYS=30
PASS="$HOME/.config/rat-backup/passphrase"     # keep a copy in a password manager
SSH="ssh -o BatchMode=yes -o ConnectTimeout=20"
mkdir -p "$DEST"
exec >> "$LOG" 2>&1
echo "== $(date -u +%FT%TZ) pull start"
new=$(rsync -rt --ignore-existing --out-format='%n' -e "$SSH" "$SRC" "$DEST/" | grep '^rat_backup_.*\.dump$' || true)
for f in $new; do
  remote=$($SSH huey "sha256sum ~/backups/rat/db/$f" | cut -d' ' -f1)
  here=$(sha256sum "$DEST/$f" | cut -d' ' -f1)
  if [ "$remote" != "$here" ]; then
    echo "CHECKSUM MISMATCH $f: removed, will retry next run"; rm -f "$DEST/$f"; exit 1
  fi
  echo "fetched $f (sha256 ok)"
done
n=$(find "$DEST" -name 'rat_backup_*.dump' | wc -l); [ "$n" -gt 0 ] || { echo "FAILED: no dumps held"; exit 1; }
find "$DEST" -name 'rat_backup_*.dump' -mtime +"$KEEP_DAYS" -delete
echo "ok: $(ls "$DEST"/rat_backup_*.dump | wc -l) dumps held, newest $(ls -t "$DEST"/rat_backup_*.dump | head -1 | xargs basename)"

# --- encrypted copy to Google Drive ---
mkdir -p "$ENC"
[ -s "$PASS" ] || { echo "FAILED: passphrase file $PASS missing"; exit 1; }
find "$DEST" -name 'rat_backup_*.dump' -mtime -"$DRIVE_KEEP_DAYS" | sort | while read -r d; do
  g="$ENC/$(basename "$d").gpg"
  [ -f "$g" ] && continue
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$PASS" \
      --symmetric --cipher-algo AES256 -o "$g.tmp" "$d"
  back=$(gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$PASS" -d "$g.tmp" | sha256sum | cut -d' ' -f1)
  [ "$back" = "$(sha256sum "$d" | cut -d' ' -f1)" ] || { rm -f "$g.tmp"; echo "FAILED: decrypt check $d"; exit 1; }
  mv "$g.tmp" "$g"; touch -r "$d" "$g"
  echo "encrypted $(basename "$g") (decrypt check ok)"
done
find "$ENC" -name '*.gpg' -mtime +"$DRIVE_KEEP_DAYS" -delete
rc=0; robocopy.exe "$ENC_WIN" "$DRIVE_WIN" '*.gpg' /MIR /R:2 /W:10 /NP /NJH /NDL /NFL > /dev/null || rc=$?
[ "$rc" -lt 8 ] || { echo "FAILED: robocopy to Drive exit $rc"; exit 1; }
echo "drive ok: $(find "$ENC" -name '*.gpg' | wc -l) encrypted dumps mirrored to $DRIVE_WIN (robocopy $rc)"
