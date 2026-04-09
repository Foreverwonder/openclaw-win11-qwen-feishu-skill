$key = [Environment]::GetEnvironmentVariable('MODELSCOPE_API_KEY', 'User')
Write-Host "Testing ModelScope API..."
Write-Host "Key exists: $($key.Length -gt 0)"

$headers = @{
    'Authorization' = "Bearer $key"
    'Content-Type' = 'application/json'
}
$body = '{"model":"ZhipuAI/GLM-5","messages":[{"role":"user","content":"Say OK"}],"max_tokens":10}'

try {
    $response = Invoke-RestMethod -Uri 'https://api-inference.modelscope.cn/v1/chat/completions' -Method Post -Headers $headers -Body $body -TimeoutSec 30
    Write-Host "ModelScope SUCCESS:"
    $response.choices[0].message.content
} catch {
    Write-Host "ModelScope ERROR: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Testing Qwen Coding Plan..."
$key2 = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
$headers2 = @{
    'Authorization' = "Bearer $key2"
    'Content-Type' = 'application/json'
}
$body2 = '{"model":"kimi-k2.5","messages":[{"role":"user","content":"Say OK"}],"max_tokens":10}'

try {
    $response2 = Invoke-RestMethod -Uri 'https://coding.dashscope.aliyuncs.com/v1/chat/completions' -Method Post -Headers $headers2 -Body $body2 -TimeoutSec 30
    Write-Host "Qwen SUCCESS:"
    $response2.choices[0].message.content
} catch {
    Write-Host "Qwen ERROR: $($_.Exception.Message)"
}
