# Herramientas oficiales de Android, aisladas en porteo; no instala Android Studio.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$packages = @(
    @{ File = 'build-tools_r35_windows.zip'; Sha1 = 'af059bb67cf7786f45ee0db85e2d24985df1b4b6'; Target = 'build-tools'; Marker = 'android-15/aapt2.exe' },
    @{ File = 'platform-35_r02.zip'; Sha1 = '0bb560a90a7a2cbd0dd8348224d518b638fe7949'; Target = 'platform'; Marker = 'android-35/android.jar' }
)
New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot 'descargas'), (Join-Path $PSScriptRoot 'sdk') | Out-Null
foreach ($package in $packages) {
    $zip = Join-Path $PSScriptRoot ('descargas/' + $package.File)
    $target = Join-Path $PSScriptRoot ('sdk/' + $package.Target)
    if (-not (Test-Path -LiteralPath $zip)) {
        Invoke-WebRequest -UseBasicParsing ('https://dl.google.com/android/repository/' + $package.File) -OutFile $zip
    }
    if ((Get-FileHash -LiteralPath $zip -Algorithm SHA1).Hash.ToLowerInvariant() -ne $package.Sha1) {
        throw "La descarga no coincide con el checksum publicado por Google: $zip"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $target $package.Marker))) {
        Expand-Archive -LiteralPath $zip -DestinationPath $target -Force
    }
}
Write-Host 'SDK preparado en porteo/sdk.'
