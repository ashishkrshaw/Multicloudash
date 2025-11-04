# Connection Test Script
# Run this in PowerShell to test all backend connections

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CloudCTRL Backend Connection Tests" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:4000"
$testsPassed = 0
$testsFailed = 0

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    Write-Host "Testing: $Name..." -NoNewline
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }
        
        if ($Headers.Count -gt 0) {
            $params.Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = 'application/json'
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201) {
            Write-Host " ✓ PASS" -ForegroundColor Green
            Write-Host "   Response: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
            return $true
        } else {
            Write-Host " ✗ FAIL (Status: $($response.StatusCode))" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host " ✗ FAIL" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "1. Server Health Check" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
if (Test-Endpoint -Name "Health Endpoint" -Url "$baseUrl/api/health") { $testsPassed++ } else { $testsFailed++ }

Write-Host "`n2. Database Connection" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
Write-Host "   Database: Neon PostgreSQL" -ForegroundColor Gray
Write-Host "   Connection: $($null -ne $env:DATABASE_URL)" -ForegroundColor Gray
if ($env:DATABASE_URL) {
    Write-Host "   ✓ Database URL configured" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "   ✗ Database URL not found" -ForegroundColor Red
    $testsFailed++
}

Write-Host "`n3. AWS Configuration" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
$awsConfigured = $env:AWS_REGION -and $env:AWS_ACCESS_KEY_ID -and $env:AWS_SECRET_ACCESS_KEY
if ($awsConfigured) {
    Write-Host "   ✓ AWS credentials configured" -ForegroundColor Green
    Write-Host "   Region: $env:AWS_REGION" -ForegroundColor Gray
    $testsPassed++
} else {
    Write-Host "   ✗ AWS credentials missing" -ForegroundColor Red
    $testsFailed++
}

Write-Host "`n4. Azure Configuration" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
$azureConfigured = $env:AZURE_TENANT_ID -and $env:AZURE_CLIENT_ID -and $env:AZURE_CLIENT_SECRET
if ($azureConfigured) {
    Write-Host "   ✓ Azure credentials configured" -ForegroundColor Green
    Write-Host "   Tenant: $env:AZURE_TENANT_ID" -ForegroundColor Gray
    $testsPassed++
} else {
    Write-Host "   ✗ Azure credentials missing" -ForegroundColor Red
    $testsFailed++
}

Write-Host "`n5. GCP Configuration" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
$gcpConfigured = $env:GOOGLE_APPLICATION_CREDENTIALS -and $env:GCP_PROJECT_ID
if ($gcpConfigured) {
    Write-Host "   ✓ GCP credentials configured" -ForegroundColor Green
    Write-Host "   Project: $env:GCP_PROJECT_ID" -ForegroundColor Gray
    $testsPassed++
} else {
    Write-Host "   ✗ GCP credentials missing" -ForegroundColor Red
    $testsFailed++
}

Write-Host "`n6. AWS Cognito Configuration" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
$cognitoConfigured = $env:COGNITO_USER_POOL_ID -and $env:COGNITO_CLIENT_ID -and $env:COGNITO_REGION
if ($cognitoConfigured) {
    Write-Host "   ✓ Cognito credentials configured" -ForegroundColor Green
    Write-Host "   User Pool: $env:COGNITO_USER_POOL_ID" -ForegroundColor Gray
    Write-Host "   Client ID: $env:COGNITO_CLIENT_ID" -ForegroundColor Gray
    $testsPassed++
} else {
    Write-Host "   ✗ Cognito credentials missing" -ForegroundColor Red
    $testsFailed++
}

Write-Host "`n7. Google OAuth Configuration" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
$googleConfigured = $env:GOOGLE_CLIENT_ID -and $env:GOOGLE_CLIENT_SECRET
if ($googleConfigured) {
    Write-Host "   ✓ Google OAuth configured" -ForegroundColor Green
    Write-Host "   Client ID: $($env:GOOGLE_CLIENT_ID.Substring(0, 20))..." -ForegroundColor Gray
    $testsPassed++
} else {
    Write-Host "   ✗ Google OAuth credentials missing" -ForegroundColor Red
    $testsFailed++
}

Write-Host "`n8. AI Assistant Configuration" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
if ($env:AI_API_KEY) {
    Write-Host "   ✓ AI API key configured" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "   ✗ AI API key missing" -ForegroundColor Red
    $testsFailed++
}

Write-Host "`n9. API Endpoints (No Auth Required)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
if (Test-Endpoint -Name "AWS Overview" -Url "$baseUrl/api/aws/overview") { $testsPassed++ } else { $testsFailed++ }
if (Test-Endpoint -Name "Azure Overview" -Url "$baseUrl/api/azure/overview") { $testsPassed++ } else { $testsFailed++ }
if (Test-Endpoint -Name "GCP Overview" -Url "$baseUrl/api/gcp/overview") { $testsPassed++ } else { $testsFailed++ }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tests Passed: $testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $testsFailed" -ForegroundColor Red
Write-Host "`nServer Status: " -NoNewline
if ($testsFailed -eq 0) {
    Write-Host "✓ ALL SYSTEMS OPERATIONAL" -ForegroundColor Green
} else {
    Write-Host "⚠ SOME ISSUES DETECTED" -ForegroundColor Yellow
}
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test with authentication token (see TESTING.md)" -ForegroundColor Gray
Write-Host "2. Test Cognito login at: https://YOUR-DOMAIN.auth.$env:COGNITO_REGION.amazoncognito.com/login" -ForegroundColor Gray
Write-Host "3. Open Prisma Studio: cd server && npx prisma studio" -ForegroundColor Gray
