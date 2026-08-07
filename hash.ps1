$files = @(
  "src/app/recibidos/actions.ts", 
  "src/app/protocolo/actions.ts", 
  "src/app/recibidos/page.tsx", 
  "src/app/recibidos/[id]/page.tsx", 
  "src/app/protocolo/page.tsx", 
  "src/app/protocolo/ProtocoloClient.tsx"
)
foreach ($f in $files) {
  $content = git show HEAD:$f
  $stream = [IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($content -join "`n"))
  $hash = (Get-FileHash -InputStream $stream -Algorithm SHA256).Hash.ToLower()
  Write-Output "$hash  $f"
}
