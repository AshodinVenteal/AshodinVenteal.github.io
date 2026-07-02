#!/usr/bin/env python3
"""
Python cannot be loaded by Mina's ModAPI directly; the game loads `mod.dll`.
This script just creates the smallest useful C++ code-mod example that calls:

    Mina->SpawnEntity(ENTITYTYPE_TEST_TRAINING_DUMMY)
"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "mod_workspace" / "modapi" / "EnemySpawnExample"
API_HINT = r"..\..\external\MinaModAPI"


MOD_CPP = r'''#include "MinaModAPI.h"
#include "MinaModEnums.h"

static MinaModAPI *Mina = nullptr;
static bool nWasDown = false;

static bool pressedN()
{
    bool down = Mina->IsKeyDown(YC_KEY_N) || Mina->IsKeyHeld(YC_KEY_N);
    bool pressed = down && !nWasDown;
    nWasDown = down;
    return pressed;
}

static void FixedUpdate(void *)
{
    if (!Mina || !Mina->SpawnEntity)
        return;

    if (pressedN())
    {
        Mina->Log("Spawning test training dummy with ModAPI SpawnEntity.\n");
        Mina->SpawnEntity(ENTITYTYPE_TEST_TRAINING_DUMMY);
    }
}

extern "C" __declspec(dllexport) void MinaMod_Init(MinaModAPI *api)
{
    Mina = api;
    Mina->InstallHook("FixedUpdate", 0, FixedUpdate);
    Mina->Log("EnemySpawnExample loaded. Press N in-game to spawn a dummy.\n");
}
'''


MOD_YC = r'''[YCD Version: 1]
MinaModDef
{
	id: "enemy_spawn_example",
	name: "Enemy Spawn Example",
	modVersion: 1,
	minGameVersion: 148667,
	maxGameVersion: 999999,
	loadPriority: 10,
};
'''


BUILD_PS1 = rf'''$ErrorActionPreference = "Stop"
$ModRoot = $PSScriptRoot
$ApiRoot = Resolve-Path (Join-Path $ModRoot "{API_HINT}")

$MsvcRoot = Get-ChildItem "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
$SdkRoot = "C:\Program Files (x86)\Windows Kits\10"
$Sdk = Get-ChildItem (Join-Path $SdkRoot "Include") -Directory |
    Where-Object {{ Test-Path (Join-Path $_.FullName "um\windows.h") }} |
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
'''


README = r'''# Enemy Spawn Example

The important line is in `src/mod.cpp`:

```cpp
Mina->SpawnEntity(ENTITYTYPE_TEST_TRAINING_DUMMY);
```

Build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

Copy `mod.yc` and `mod.dll` into:

```text
%APPDATA%\Yacht Club Games\Mina the Hollower\mods\EnemySpawnExample
```

Launch Mina with:

```text
-mod -mod-allow-code
```

Press `N` in-game to request a test training dummy spawn.
'''


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(path)


def main() -> None:
    write(OUT / "src" / "mod.cpp", MOD_CPP)
    write(OUT / "mod.yc", MOD_YC)
    write(OUT / "build.ps1", BUILD_PS1)
    write(OUT / "README.md", README)
    print("\nTiny EnemySpawnExample.")


if __name__ == "__main__":
    main()
