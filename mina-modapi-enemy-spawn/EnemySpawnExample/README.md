# Enemy Spawn Example

This is the smallest practical ModAPI enemy-spawn example.

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
