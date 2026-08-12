$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8843

$mime = @{
  ".html"="text/html"; ".css"="text/css"; ".js"="application/javascript";
  ".mp4"="video/mp4"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".png"="image/png";
  ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".m4a"="audio/mp4"; ".mp3"="audio/mpeg"
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()
Write-Host "Serving $root on port $port (all network interfaces, no admin needed)"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 5000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }

    while (($line = $reader.ReadLine()) -and $line -ne "") { }

    $parts = $requestLine -split ' '
    $path = $parts[1]
    if ($path -eq "/") { $path = "/index.html" }
    $path = [System.Uri]::UnescapeDataString($path.Split('?')[0])
    $filePath = Join-Path $root ($path.TrimStart("/"))

    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath)
      $ct = $mime[$ext]
      if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $header = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($bytes, 0, $bytes.Length)
    } else {
      $msg = "404 Not Found: $path"
      $msgBytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($msgBytes.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($msgBytes, 0, $msgBytes.Length)
    }
    $stream.Flush()
  } catch {
    Write-Host "Error: $_"
  } finally {
    $client.Close()
  }
}
