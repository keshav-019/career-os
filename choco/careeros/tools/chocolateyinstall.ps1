$ErrorActionPreference = 'Stop'

$packageName = 'careeros'
$toolsDir    = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"
$url         = 'https://github.com/keshav-019/career-os/releases/download/v1.0.0/CareerOS-1.0.0-x64.exe'
# TODO: replace with the real SHA-256 from checksums.txt on the v1.0.0 release once the build finishes.
$checksum    = 'REPLACE_WITH_SHA256'
$checksumType = 'sha256'

$packageArgs = @{
  packageName    = $packageName
  fileType       = 'exe'
  url            = $url
  softwareName   = 'CareerOS*'
  checksum       = $checksum
  checksumType   = $checksumType
  # electron-builder's NSIS installer supports the standard NSIS silent switch.
  silentArgs     = '/S'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
