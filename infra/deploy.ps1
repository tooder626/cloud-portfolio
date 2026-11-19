[CmdletBinding()]
param(
    [string]$Region = 'ap-northeast-2',
    [string]$Profile
)

$ErrorActionPreference = 'Stop'
$aws = Get-Command aws -CommandType Application -ErrorAction Stop
$stackName = 'cloud-portfolio-week1'
$site = Join-Path (Split-Path $PSScriptRoot -Parent) 'site'
$awsOptions = @('--region', $Region, '--no-cli-pager')
if ($Profile) { $awsOptions += @('--profile', $Profile) }

function Invoke-AwsCli {
    $result = & $aws.Source @awsOptions @args
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI command failed: $($args[0]) $($args[1]) (exit $LASTEXITCODE)"
    }
    $result
}

Invoke-AwsCli sts get-caller-identity --query Arn --output text
Invoke-AwsCli cloudformation deploy --stack-name $stackName --template-file (Join-Path $PSScriptRoot 'hosting.yml') --no-fail-on-empty-changeset

$outputs = @{}
$stackOutputs = Invoke-AwsCli cloudformation describe-stacks --stack-name $stackName --query 'Stacks[0].Outputs' --output json
foreach ($output in ($stackOutputs | Out-String | ConvertFrom-Json)) {
    $outputs[$output.OutputKey] = $output.OutputValue
}

$bucket = $outputs.BucketName
$distribution = $outputs.CloudFrontDistributionId
Invoke-AwsCli s3 sync $site "s3://$bucket/" --exclude '*' --include 'index.html' --include 'styles.css'
$invalidation = Invoke-AwsCli cloudfront create-invalidation --distribution-id $distribution --paths '/' '/index.html' '/styles.css' --query 'Invalidation.Id' --output text
Invoke-AwsCli cloudfront wait invalidation-completed --distribution-id $distribution --id $invalidation
Invoke-AwsCli cloudfront wait distribution-deployed --id $distribution

$curl = Get-Command curl.exe -CommandType Application -ErrorAction Stop
foreach ($url in @($outputs.CloudFrontUrl, "$($outputs.CloudFrontUrl)styles.css", $outputs.DirectS3ObjectUrl)) {
    $expectedStatus = if ($url -eq $outputs.DirectS3ObjectUrl) { '403' } else { '200' }
    $status = & $curl.Source --silent --show-error --max-time 30 --output NUL --write-out '%{http_code}' $url
    if ($LASTEXITCODE -ne 0 -or $status -ne $expectedStatus) {
        throw "Expected HTTP $expectedStatus but received $status from $url"
    }
    Write-Output "HTTP $status  $url"
}
