# =============================================================================
# dev-up.ps1 — bring up the full local policing-apps platform stack
# Each service runs in its own PowerShell window so you can see logs and Ctrl-C
# individually. Re-run any time; it kills stale port owners first.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
#
# Access after startup:
#   Platform shell : http://localhost:5176   (admin-kerala / password123 / 000000)
#   DOPAMS UI      : http://localhost:5175
#   Social Media   : http://localhost:5177
#   Forensic UI    : http://localhost:5178
# =============================================================================
# LaunchMode controls where the platform's app tiles point:
#   production (default) : the working cloud apps (*.adssoftek.com) — run the shell
#                          locally, launch into production. All tiles clickable; each
#                          production app handles its own login (no cross-env SSO).
#   local                : the local dev UIs (:5175/5177/5178) with real ABAC scoping
#                          and local SSO auto-login (log in as the scoped persona).
param([ValidateSet("production","local")][string]$LaunchMode = "production")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$SSO  = "platform-sso-dev-shared-secret-0001"

$prodTargets = '{"dopams":"https://police-dopams.adssoftek.com","iqw":"https://police-complaints.adssoftek.com","forensic":"https://police-forensic.adssoftek.com","social-media":"https://police-smmt.adssoftek.com","knowledge":"https://puda-kbase.adssoftek.com"}'
$localTargets = '{"dopams":"http://localhost:5175","forensic":"http://localhost:5178","social-media":"http://localhost:5177"}'

# Base platform-api env; launch-specific keys added per mode below.
$platformEnv = @{ NODE_ENV="development"; DATABASE_SSL="false";
  DATABASE_URL="postgres://puda:puda@localhost:5432/platform";
  PLATFORM_SESSION_SECRET="platform-session-dev-secret-please-change-0001";
  PLATFORM_DEMO_TOTP_CODE="000000"; PLATFORM_PROJECTION_TTL_SECONDS="31536000";
  PORT="8080" }
if ($LaunchMode -eq "production") {
  # Point every tile at the cloud apps; make them all clickable; plain redirects
  # (no local SSO token — production apps authenticate you themselves).
  $platformEnv.PLATFORM_LAUNCH_TARGETS = $prodTargets
  $platformEnv.PLATFORM_DEMO_ALLOW_ALL_LAUNCHES = "true"
} else {
  # Local dev apps with real entitlement scoping + local SSO handoff.
  $platformEnv.PLATFORM_LAUNCH_TARGETS = $localTargets
  $platformEnv.PLATFORM_SSO_SECRET = $SSO
}
Write-Host "LaunchMode = $LaunchMode"

# Free the ports first (ignore errors if nothing is listening).
$ports = 8080,3011,3012,3004,5176,5175,5177,5178
Write-Host "Freeing ports $($ports -join ', ') ..."
& npx --yes kill-port @ports 2>$null | Out-Null

# name, env-hashtable, command-string
$services = @(
  @{ n="platform-api"; e=$platformEnv; c="node_modules\.bin\tsx apps\platform-api\src\server.ts" }

  @{ n="dopams-api"; e=@{ NODE_ENV="development"; DATABASE_SSL="false"; JWT_SECRET="dopams-local-dev-secret";
       DOPAMS_DATABASE_URL="postgres://puda:puda@localhost:5432/dopams"; PORT="3011";
       ALLOWED_ORIGINS="http://localhost:5175"; PLATFORM_SSO_SECRET=$SSO; PLATFORM_SSO_FALLBACK_USER="admin" };
     c="node_modules\.bin\tsx apps\dopams-api\src\index.ts" }

  @{ n="forensic-api"; e=@{ NODE_ENV="development"; DATABASE_SSL="false"; JWT_SECRET="forensic-local-dev-secret";
       FORENSIC_DATABASE_URL="postgres://puda:puda@localhost:5432/forensic"; PORT="3012";
       ALLOWED_ORIGINS="http://localhost:5178"; PLATFORM_SSO_SECRET=$SSO; PLATFORM_SSO_FALLBACK_USER="admin" };
     c="node_modules\.bin\tsx apps\forensic-api\src\index.ts" }

  @{ n="social-media-api"; e=@{ NODE_ENV="development"; DATABASE_SSL="false"; JWT_SECRET="sm-local-dev-secret";
       SM_DATABASE_URL="postgres://puda:puda@localhost:5432/social_media"; PORT="3004";
       ALLOWED_ORIGINS="http://localhost:5177"; PLATFORM_SSO_SECRET=$SSO; PLATFORM_SSO_FALLBACK_USER="admin" };
     c="node_modules\.bin\tsx apps\social-media-api\src\index.ts" }

  @{ n="platform-web";     e=@{}; c="npm run dev --workspace=apps/platform-web" }
  @{ n="dopams-ui";        e=@{}; c="npm run dev --workspace=apps/dopams-ui" }
  @{ n="social-media-ui";  e=@{}; c="npm run dev --workspace=apps/social-media-ui" }
  @{ n="forensic-ui";      e=@{}; c="npm run dev --workspace=apps/forensic-ui -- --port 5178 --strictPort" }
)

foreach ($s in $services) {
  # Set env in THIS process; the child powershell inherits it at spawn. This keeps
  # JSON values (PLATFORM_LAUNCH_TARGETS) intact — no quote-nesting in the command.
  foreach ($k in $s.e.Keys) { Set-Item -Path "env:$k" -Value $s.e[$k] }
  $inner = "`$host.UI.RawUI.WindowTitle='$($s.n)'; Set-Location '$root'; $($s.c)"
  Start-Process powershell -ArgumentList "-NoExit","-Command",$inner | Out-Null
  Write-Host "started $($s.n)"
  Start-Sleep -Milliseconds 400
}

Write-Host ""
Write-Host "All services launching in separate windows."
Write-Host "Platform shell: http://localhost:5176   (admin-kerala / password123 / 000000)"
