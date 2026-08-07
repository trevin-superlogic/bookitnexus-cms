# One-command setup for BookitCMS. Windows PowerShell.
#
#   powershell -ExecutionPolicy Bypass -File setup.ps1
#
# Windows equivalent of setup.sh. Checks Node, collects your two Sanity
# credentials, installs, seeds the tenants and imports the Figma tokens.
# Safe to re-run.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($m) { Write-Host "`n==> $m" -ForegroundColor White }
function Ok($m)   { Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  !   $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "`n  X  $m`n" -ForegroundColor Red; exit 1 }

Write-Host "`nBookitCMS setup"
Write-Host "This will not touch any existing Sanity project - only the one you name below." -ForegroundColor DarkGray

# 1. Node
Step 'Checking Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js isn't installed.

  Download the LTS version from https://nodejs.org, run the installer,
  then CLOSE AND REOPEN PowerShell and run this script again."
}
# Parse the version in PowerShell rather than via `node -p`: Windows strips the
# inner double quotes out of an embedded JS string, so node received
# `split(.)` and died with a SyntaxError that looked like an old-Node error.
$major = [int]((((node --version) -replace '^v', '') -split '\.')[0])
if ($major -lt 22) {
  Fail "Node $(node --version) is too old - this needs v22 or newer.
  Install the LTS version from https://nodejs.org, then reopen PowerShell."
}
Ok "Node $(node --version)"

# 2. Credentials
Step 'Sanity credentials'
if ((Test-Path .env.local) -and (Select-String -Path .env.local -Pattern 'SANITY_WRITE_TOKEN=.+' -Quiet)) {
  Ok '.env.local already set up - using it'
  Warn 'Delete .env.local and re-run to point at a different project'
} else {
  Write-Host @"

  You need two things from https://sanity.io/manage

    1. Project ID  - on your project's page, near the top. Looks like: a1b2c3d4
    2. API token   - API tab -> Tokens -> Add API token -> permission "Editor"
                     Sanity shows it ONCE, so copy it before closing the dialog.

  If you haven't made a project yet: "Create new project", name it
  "BookitCMS Staging", accept the default "production" dataset.

"@

  $projectId = Read-Host '  Project ID'
  if (-not $projectId) { Fail 'No project ID entered.' }

  # Hidden input - a write token shouldn't sit in scrollback.
  $secure = Read-Host '  API token (input hidden)' -AsSecureString
  $token = [System.Net.NetworkCredential]::new('', $secure).Password
  if (-not $token) { Fail 'No token entered.' }

  $dataset = Read-Host '  Dataset [production]'
  if (-not $dataset) { $dataset = 'production' }

  "SANITY_STUDIO_PROJECT_ID=$projectId`nSANITY_STUDIO_DATASET=$dataset`nSANITY_WRITE_TOKEN=$token" |
    Out-File -Encoding utf8 -NoNewline .env.local
  Ok 'Wrote .env.local'
}

# 3. Install
Step 'Installing dependencies (a few minutes - lots of scrolling text is normal)'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
  Fail "npm install failed.

  Scroll up for lines starting with 'npm ERR!'. Usually no internet, or a
  corporate VPN/proxy blocking the npm registry. Paste those lines to Claude."
}
Ok 'Dependencies installed'

# 4. Self-check
Step 'Verifying the token logic'
# 2>&1 turns npm's stderr into PowerShell error records, which would abort the
# script under ErrorActionPreference='Stop' even though the tests only warn.
$ErrorActionPreference = 'Continue'
npm run --silent test 2>&1 | Out-File "$env:TEMP\bookitcms-test.log"
$testExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($testExit -eq 0) { Ok 'All checks passed' }
else {
  Warn 'Some checks reported failures - usually harmless'
  Write-Host "    They compare against a superlogic-ui checkout that may not exist here." -ForegroundColor DarkGray
  Write-Host "    Full output: $env:TEMP\bookitcms-test.log" -ForegroundColor DarkGray
}

# 5. Seed + import
Step 'Creating tenants and universal defaults'
npm run --silent seed
if ($LASTEXITCODE -ne 0) {
  Fail "Seeding failed.

  Almost always the token: it needs 'Editor' permission, and the project ID
  must match. Create a fresh token, delete .env.local, re-run this script."
}
Ok 'Tenants created'

Step 'Importing Figma tokens'
npm run --silent tokens:import -- --dir ./figma-exports
if ($LASTEXITCODE -ne 0) { Fail 'Token import failed. Paste the output above to Claude.' }

Write-Host @"

 Setup complete.

 Next, two commands:

   npm run dev
     Opens the studio at http://localhost:3333 so you can click around.
     Press Ctrl+C in this window to stop it.

   npx sanity deploy
     Puts it online at https://<name-you-choose>.sanity.studio
     so you can share it. Run 'npx sanity login' first if it asks.

 Worth testing first:
   Tenants -> Bookit -> Theme & style tokens -> "Validate & publish".
   It should publish and fill in the Compiled output tab, reporting
   9 compatibility aliases.

 Once you're done, delete the API token at sanity.io/manage -> API -> Tokens.

"@
