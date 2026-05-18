# Setup one-shot del CI/CD para Plataforma IA en github.ibm.com.
#
# Crea la service account de GCP para CI, le da permisos, genera la key,
# carga todos los secretos + variables al repo de GitHub Enterprise y
# borra la key local. Solo el Vercel token requiere paso manual previo
# (vercel.com/account/tokens → copiar al portapapeles).
#
# Prerequisitos:
#   - gcloud CLI autenticado con permisos de Owner en plataformaia-496701
#   - gh CLI autenticado a github.ibm.com (`gh auth login --hostname github.ibm.com`)
#   - .vercel/project.json existe (es decir, ya hiciste vercel deploy una vez)
#   - Tener el Vercel token a mano
#
# Ejecución (desde la raíz del repo):
#   .\scripts\setup-ci.ps1

$ErrorActionPreference = "Stop"

$PROJECT   = "plataformaia-496701"
$CI_SA     = "plataforma-ia-ci@$PROJECT.iam.gserviceaccount.com"
$RUNNER_SA = "plataforma-ia-runner@$PROJECT.iam.gserviceaccount.com"

Write-Host "==> 1/5 Creando service account de CI en GCP..." -ForegroundColor Cyan
# `--quiet` para no romper si ya existe
gcloud iam service-accounts create plataforma-ia-ci `
  --display-name="CI deploy to Cloud Run" `
  --project=$PROJECT 2>$null

Write-Host "==> 2/5 Asignando permisos..." -ForegroundColor Cyan
foreach ($role in @("roles/run.admin", "roles/storage.admin", "roles/artifactregistry.writer", "roles/cloudbuild.builds.editor")) {
  Write-Host "    - $role"
  gcloud projects add-iam-policy-binding $PROJECT `
    --member="serviceAccount:$CI_SA" --role="$role" --quiet | Out-Null
}

# Permitir que la SA de CI use la SA de runtime
gcloud iam service-accounts add-iam-policy-binding $RUNNER_SA `
  --member="serviceAccount:$CI_SA" `
  --role="roles/iam.serviceAccountUser" --quiet | Out-Null

Write-Host "==> 3/5 Generando key JSON..." -ForegroundColor Cyan
$keyFile = "plataforma-ia-ci.json"
if (Test-Path $keyFile) { Remove-Item $keyFile -Force }
gcloud iam service-accounts keys create $keyFile `
  --iam-account=$CI_SA --quiet

Write-Host ""
Write-Host "==> 4/5 Cargando secretos + variables a github.ibm.com..." -ForegroundColor Cyan
Write-Host "    (Se te van a pedir 3 valores: ANTHROPIC_API_KEY, MONGODB_URI, VERCEL_TOKEN)"
Write-Host ""

# GCP SA key (desde archivo)
Write-Host "    [secret] GCP_SA_KEY"
Get-Content $keyFile -Raw | gh secret set GCP_SA_KEY

# Anthropic key
Write-Host "    [secret] ANTHROPIC_API_KEY (pegá tu sk-ant-... y Enter)"
gh secret set ANTHROPIC_API_KEY

# Mongo URI
Write-Host "    [secret] MONGODB_URI (pegá tu mongodb+srv://... y Enter)"
gh secret set MONGODB_URI

# Vercel token
Write-Host "    [secret] VERCEL_TOKEN (pegá el token de vercel.com/account/tokens y Enter)"
gh secret set VERCEL_TOKEN

# Variables desde .vercel/project.json
$projectJsonPath = "plataforma-ia-front\.vercel\project.json"
if (-not (Test-Path $projectJsonPath)) {
  Write-Host ""
  Write-Host "ERROR: No se encontró $projectJsonPath" -ForegroundColor Red
  Write-Host "Hacé `vercel deploy` primero al menos una vez para que se cree."
  exit 1
}
$proj = Get-Content $projectJsonPath -Raw | ConvertFrom-Json
Write-Host "    [variable] VERCEL_ORG_ID    = $($proj.orgId)"
gh variable set VERCEL_ORG_ID --body $proj.orgId
Write-Host "    [variable] VERCEL_PROJECT_ID = $($proj.projectId)"
gh variable set VERCEL_PROJECT_ID --body $proj.projectId
Write-Host "    [variable] VERCEL_DOMAIN    = https://plataforma-ia-front.vercel.app"
gh variable set VERCEL_DOMAIN --body "https://plataforma-ia-front.vercel.app"

Write-Host ""
Write-Host "==> 5/5 Borrando key local..." -ForegroundColor Cyan
Remove-Item $keyFile -Force
Write-Host "    OK — la key solo existe en GitHub Secrets ahora."

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "Setup completo." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. git add .github/workflows/"
Write-Host "  2. git commit -m 'ci: GitHub Actions deploy a Cloud Run + Vercel'"
Write-Host "  3. git push origin main"
Write-Host ""
Write-Host "Después corré:  gh run watch    (para ver los workflows en vivo)"
Write-Host "O en browser:   https://github.ibm.com/jorgetapia/PlataformaIA/actions"
