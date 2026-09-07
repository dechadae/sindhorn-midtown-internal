# Render smoke, 7 September 2026 — Android emulator

**This is not Tier B.** Tier B is a frozen, sampled, rendered measurement, and it
has not been run on any platform. This file records a single manual observation
made while standing the Android specimen surface up, so that what was actually
seen is on the record before any sampled run is designed around it.

- Test: IDUI Test 04 (see `PROTOCOL.md` amendment A3)
- Implementation: Kotlin / OpenGL ES 2.0, `betta-wallpaper` repo
- Code state: `3f5a2a1a1544bf02d75fa31ef399930711c368b9`
- Constitution sha256: `48e239067408428afbc4e3dd85b8f6da28cc1d89e8d78d98a4924ee1cf152299`

## Surface

A real Android emulator, not a simulation of one: `system-images;android-34;google_apis;arm64-v8a`,
API 34, software GL (swiftshader), 1080×2400 portrait. The APK was installed with
`adb install`, the activity launched with `am start`, and frames captured with
`adb shell screencap`.

## What was observed

- The app launched without crashing.
- The GLSL vertex and fragment shaders compiled and linked on a real GLES driver.
  `buildProgram` throws on link failure, and no exception appeared in logcat, so
  this is an observed state rather than an assumption.
- The live contract check ran on-device and logged
  `seed=0 valid=true violations=[]`.
- The first captured frame showed the form clipped at the top and right edges of
  the viewport.
- Camera distance was changed 3.2 → 5.5 and the mesh radius scale 1.6 → 1.1. The
  second capture showed the whole form inside the frame.
- The second capture still showed the form sitting right of centre with a large
  empty area to its left.

## What this does and does not support

It supports: the renderer runs, the shaders compile on a real driver, and the
generator's output reaches the screen.

It does not support anything about validity across seeds. **One seed was
rendered.** Nothing here speaks to the other 99,999 that passed Tier A, to other
aspect ratios, or to any moment other than the one the capture happened to catch.

The off-centre framing is recorded as finding **D-P-01** in
`findings-20260907.md`. It is unresolved: the owner has not seen and accepted a
fixed version, and per the evidence law a D-P count only stands against a result
that has been editorially accepted.
