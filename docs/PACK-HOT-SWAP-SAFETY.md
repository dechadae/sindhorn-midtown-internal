# UI pack hot-swap safety

Executable shell/runtime changes and remotely editable UI-pack changes have separate version lifecycles.

## Release rule

- Increment `SHELL_VERSION` whenever executable bootstrap/router/environment/service-worker behavior changes in a way that can affect pack application or the persistent renderer.
- A UI pack that depends on that executable behavior must set `minimumShell` to that new shell version.
- A running older shell must reject, not cache, and not apply an incompatible newer pack. It keeps its current known-good pack and persistent atmosphere until the app naturally restarts under the new shell.
- Pull-to-refresh must never reload the document to resolve a shell/pack mismatch.

## Compatible hot swaps

When a compatible newer pack is applied in place, presentation replacement can cause an Android browser compositor to momentarily detach or stale-cache the fixed WebGL layer. The shell therefore forces a compositor rebind after the pack DOM/CSS swap while leaving the WebGL context and environmental state alive.

The atmosphere remains authoritative and persistent; a UI-pack refresh is never allowed to recreate environmental state from scratch.
