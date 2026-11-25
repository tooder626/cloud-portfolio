[CmdletBinding()]
param(
    [string]$Region = 'ap-northeast-2',
    [string]$Profile
)

$ErrorActionPreference = 'Stop'
$aws = Get-Command aws -CommandType Application -ErrorAction Stop
$options = @('--region', $Region, '--no-cli-pager')
if ($Profile) { $options += @('--profile', $Profile) }
$site = Join-Path (Split-Path $PSScriptRoot -Parent) 'site'

function Invoke-Aws {
    $result = & $aws.Source @options @args
    if ($LASTEXITCODE -ne 0) { throw "AWS command failed: $($args[0]) $($args[1])" }
    $result
}

function Get-StackOutputs([string]$StackName) {
    $json = Invoke-Aws cloudformation describe-stacks --stack-name $StackName --query 'Stacks[0].Outputs' --output json
    $outputs = @{}
    foreach ($item in ($json | Out-String | ConvertFrom-Json)) { $outputs[$item.OutputKey] = $item.OutputValue }
    $outputs
}

$hosting = Get-StackOutputs 'cloud-portfolio-week1'
Invoke-Aws cloudformation deploy --stack-name 'cloud-portfolio-week3' --template-file (Join-Path $PSScriptRoot 'guestbook.yml') --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset
$guestbook = Get-StackOutputs 'cloud-portfolio-week3'

$keyJson = Invoke-Aws appsync list-api-keys --api-id $guestbook.GuestbookApiId --output json
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$key = ($keyJson | Out-String | ConvertFrom-Json).apiKeys |
    Where-Object { $_.description -eq 'Week 3 guestbook demo' -and $_.expires -gt $now } |
    Sort-Object expires -Descending | Select-Object -First 1
if (!$key.id) { throw 'The demo API key is missing or expired.' }

function Invoke-Guestbook([string]$Query, [hashtable]$Variables = @{}) {
    $body = @{ query = $Query; variables = $Variables } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Method Post -Uri $guestbook.GuestbookGraphQLUrl -Headers @{ 'x-api-key' = $key.id } -ContentType 'application/json; charset=utf-8' -Body $body
    $response
}

$invalid = Invoke-Guestbook 'mutation { addGuestbookEntry(nickname: " ", message: "test") { id } }'
if ($invalid.errors[0].errorType -ne 'InvalidInput') { throw 'Invalid input was not rejected as expected.' }

$testMessage = 'AppSync 배포 검증 ' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$created = Invoke-Guestbook 'mutation Smoke($message: String!) { addGuestbookEntry(nickname: "배포 테스트", message: $message) { id nickname message createdAt } }' @{ message = $testMessage }
if ($created.errors -or $created.data.addGuestbookEntry.message -ne $testMessage) { throw 'Guestbook write failed.' }
$listed = Invoke-Guestbook 'query { guestbookEntries { id nickname message createdAt } }'
if ($listed.errors -or $listed.data.guestbookEntries.id -notcontains $created.data.addGuestbookEntry.id) { throw 'Guestbook read did not return the saved entry.' }

$configFile = [IO.Path]::GetTempFileName()
try {
    $config = @{ endpoint = $guestbook.GuestbookGraphQLUrl; apiKey = $key.id } | ConvertTo-Json -Compress
    Set-Content -LiteralPath $configFile -Value "globalThis.guestbookConfig = $config;" -Encoding utf8NoBOM
    $bucket = $hosting.BucketName
    Invoke-Aws s3 cp (Join-Path $site 'guestbook.js') "s3://$bucket/guestbook.js" --content-type 'text/javascript; charset=utf-8'
    Invoke-Aws s3 cp $configFile "s3://$bucket/guestbook-config.js" --content-type 'text/javascript; charset=utf-8' --cache-control 'no-store'
    Invoke-Aws s3 cp (Join-Path $site 'styles.css') "s3://$bucket/styles.css" --content-type 'text/css; charset=utf-8'
    Invoke-Aws s3 cp (Join-Path $site 'index.html') "s3://$bucket/index.html" --content-type 'text/html; charset=utf-8'
} finally {
    Remove-Item -LiteralPath $configFile
}
$id = Invoke-Aws cloudfront create-invalidation --distribution-id $hosting.CloudFrontDistributionId --paths '/' '/index.html' '/styles.css' '/guestbook.js' '/guestbook-config.js' --query 'Invalidation.Id' --output text
Invoke-Aws cloudfront wait invalidation-completed --distribution-id $hosting.CloudFrontDistributionId --id $id
Write-Output "Verified live GraphQL validation, write and read."
Write-Output $hosting.CloudFrontUrl
