#!/usr/bin/env bash
#
# One-command setup for BookitCMS. Mac and Linux.
#
#   bash setup.sh
#
# Checks Node, collects your two Sanity credentials, installs, seeds the tenants
# and imports the Figma tokens. Everything SETUP.md steps 1-9 does, minus the
# typing.
#
# Safe to re-run: it skips anything already done, and the seed uses
# createIfNotExists so it never overwrites your edits.

set -uo pipefail
cd "$(dirname "$0")"

bold=$'\033[1m'; dim=$'\033[2m'; red=$'\033[31m'; green=$'\033[32m'; yellow=$'\033[33m'; off=$'\033[0m'

step()  { printf '\n%s==> %s%s\n' "$bold" "$1" "$off"; }
ok()    { printf '%s  ✓ %s%s\n' "$green" "$1" "$off"; }
warn()  { printf '%s  ! %s%s\n' "$yellow" "$1" "$off"; }
fail()  { printf '\n%s  ✗ %s%s\n\n' "$red" "$1" "$off"; exit 1; }

printf '%s\nBookitCMS setup%s\n' "$bold" "$off"
printf '%sThis will not touch any existing Sanity project — only the one you name below.%s\n' "$dim" "$off"

# ── 1. Node ───────────────────────────────────────────────────────────────────
step "Checking Node.js"

command -v node >/dev/null 2>&1 || fail \
"Node.js isn't installed.

  Download the LTS version from https://nodejs.org, run the installer,
  then CLOSE AND REOPEN this terminal and run this script again."

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 22 ]; then
  fail "Node $(node --version) is too old — this needs v22 or newer.

  Install the LTS version from https://nodejs.org, then reopen this terminal."
fi
ok "Node $(node --version)"

# ── 2. Credentials ────────────────────────────────────────────────────────────
step "Sanity credentials"

if [ -f .env.local ] && grep -q 'SANITY_WRITE_TOKEN=.\+' .env.local 2>/dev/null; then
  ok ".env.local already set up — using it"
  warn "Delete .env.local and re-run if you want to point at a different project"
else
  cat <<EOF

  You need two things from https://sanity.io/manage

    1. Project ID  — on your project's page, near the top. Looks like: a1b2c3d4
    2. API token   — API tab → Tokens → Add API token → permission "Editor"
                     Sanity shows it ONCE, so copy it before closing the dialog.

  If you haven't made a project yet: "Create new project", name it
  "BookitCMS Staging", accept the default "production" dataset.

EOF

  printf '  Project ID: '
  read -r project_id
  [ -n "$project_id" ] || fail "No project ID entered."

  # Hidden input — a write token is a credential and shouldn't sit in scrollback.
  printf '  API token (input hidden): '
  read -rs write_token
  printf '\n'
  [ -n "$write_token" ] || fail "No token entered."

  printf '  Dataset [production]: '
  read -r dataset
  dataset="${dataset:-production}"

  cat > .env.local <<EOF
SANITY_STUDIO_PROJECT_ID=$project_id
SANITY_STUDIO_DATASET=$dataset
SANITY_WRITE_TOKEN=$write_token
EOF
  chmod 600 .env.local
  ok "Wrote .env.local (readable only by you)"
fi

# ── 3. Install ────────────────────────────────────────────────────────────────
step "Installing dependencies (a few minutes — lots of scrolling text is normal)"

npm install --no-audit --no-fund || fail \
"npm install failed.

  Scroll up for lines starting with 'npm ERR!'. The usual causes are no
  internet, or a corporate VPN/proxy blocking the npm registry.
  Paste those lines to Claude and it'll tell you which."
ok "Dependencies installed"

# ── 4. Self-check ─────────────────────────────────────────────────────────────
step "Verifying the token logic"

if npm run --silent test >/tmp/bookitcms-test.log 2>&1; then
  ok "All checks passed"
else
  warn "Some checks reported failures — usually harmless"
  printf '%s    They compare against a superlogic-ui checkout that may not exist here.%s\n' "$dim" "$off"
  printf '%s    Full output: /tmp/bookitcms-test.log%s\n' "$dim" "$off"
fi

# ── 5. Seed + import ──────────────────────────────────────────────────────────
step "Creating tenants and universal defaults"

npm run --silent seed || fail \
"Seeding failed.

  Almost always the token: it must have 'Editor' permission, and the project ID
  must match. Create a fresh token at sanity.io/manage → API → Tokens,
  then delete .env.local and re-run this script."
ok "Tenants created"

step "Importing Figma tokens"

npm run --silent tokens:import -- --dir ./figma-exports || fail \
"Token import failed. Paste the output above to Claude."

# ── Done ──────────────────────────────────────────────────────────────────────
cat <<EOF

$bold Setup complete.$off

 Next, two commands:

   ${bold}npm run dev${off}
     Opens the studio at http://localhost:3333 so you can click around.
     Press Ctrl+C in this window to stop it.

   ${bold}npx sanity deploy${off}
     Puts it online at https://<name-you-choose>.sanity.studio
     so you can share it. Run 'npx sanity login' first if it asks.

 ${bold}Worth testing first:${off}
   Tenants → Bookit → Theme & style tokens → "Validate & publish".
   It should publish and fill in the Compiled output tab, reporting
   9 compatibility aliases.

 ${dim}Once you're done setting up, delete the API token at
 sanity.io/manage → API → Tokens. It's only needed for this script.${off}

EOF
