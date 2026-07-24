$ErrorActionPreference = 'Stop'

$packageName = 'careeros'
$toolsDir    = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"
$url         = 'https://github.com/keshav-019/career-os/releases/download/v1.0.0/CareerOS-1.0.0-x64.exe'
$checksum    = '12f0eea8b60ae755415f5c506043c944c88463516574d67eea5c2b09e0edf9cd'
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
