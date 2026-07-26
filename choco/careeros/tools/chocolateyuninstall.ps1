$ErrorActionPreference = 'Stop'

$packageName = 'careeros'
$softwareName = 'CareerOS*'

$uninstalled = $false
[array]$key = Get-UninstallRegistryKey -SoftwareName $softwareName

if ($key.Count -eq 1) {
  $key | ForEach-Object {
    $file = "$($_.UninstallString)"
    if ($file -notlike "*.exe*") {
      Write-Warning "$file is not recognized as a valid path. Skipping."
      return
    }

    $silentArgs = '/S'
    $validExitCodes = @(0)

    Uninstall-ChocolateyPackage -PackageName $packageName `
      -FileType 'exe' `
      -SilentArgs "$silentArgs" `
      -ValidExitCodes $validExitCodes `
      -File "$file"
  }
} elseif ($key.Count -eq 0) {
  Write-Warning "$packageName has already been uninstalled by other means."
} elseif ($key.Count -gt 1) {
  Write-Warning "$($key.Count) matches found for $softwareName - uninstall manually via Add/Remove Programs."
}
