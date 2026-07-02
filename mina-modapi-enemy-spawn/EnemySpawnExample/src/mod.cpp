#include "MinaModAPI.h"
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
