$ErrorActionPreference = "Stop"
$ModRoot = $PSScriptRoot
$ApiRoot = Resolve-Path (Join-Path $ModRoot "..\..\external\MinaModAPI")

$MsvcRoot = Get-ChildItem "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
$SdkRoot = "C:\Program Files (x86)\Windows Kits\10"
$Sdk = Get-ChildItem (Join-Path $SdkRoot "Include") -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName "um\windows.h") } |
    Sort-Object Name -Descending |
    Select-Object -First 1

$VcBin = Join-Path $MsvcRoot.FullName "bin\Hostx64\x64"
$env:PATH = "$VcBin;$(Join-Path $SdkRoot "bin\$($Sdk.Name)\x64");$env:PATH"
$env:INCLUDE = @(
    (Join-Path $MsvcRoot.FullName "include"),
    (Join-Path $Sdk.FullName "ucrt"),
    (Join-Path $Sdk.FullName "shared"),
    (Join-Path $Sdk.FullName "um")
) -join ";"
$env:LIB = @(
    (Join-Path $MsvcRoot.FullName "lib\x64"),
    (Join-Path $SdkRoot "Lib\$($Sdk.Name)\ucrt\x64"),
    (Join-Path $SdkRoot "Lib\$($Sdk.Name)\um\x64")
) -join ";"

cl /nologo /std:c++17 /EHsc /LD /I"$ApiRoot" "$ModRoot\src\mod.cpp" /Fo"$ModRoot\mod.obj" /Fe"$ModRoot\mod.dll"
Write-Host "Built $ModRoot\mod.dll"
