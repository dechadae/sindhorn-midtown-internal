from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'{label}: expected source block not found in {path}')
    path.write_text(text.replace(old, new, 1))

root = Path('android-betta-wallpaper')
renderer = root / 'app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaRenderer.kt'
service = root / 'app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaWallpaperService.kt'
guard = root / 'tools/verify_performance_contract.py'

replace_once(
    renderer,
    '    private var commonUniformFrom = -1\n    private var commonUniformTo = -1\n',
    '    private var commonUniformFrom = -1\n    private var commonUniformTo = -1\n    private var backgroundUniformFrom = -1\n    private var backgroundUniformTo = -1\n',
    'background uniform cache fields',
)
replace_once(
    renderer,
    '''    private fun drawBackground(from: BettaPreset, to: BettaPreset, e: Float) {\n        GLES30.glUseProgram(backgroundProgram)\n        for (i in 0..2) {\n            uniform3Bg("uBg${i}From", from.background[i])\n            uniform3Bg("uBg${i}To", to.background[i])\n        }\n        uniform1Bg("uMix", e)\n''',
    '''    private fun drawBackground(from: BettaPreset, to: BettaPreset, e: Float) {\n        GLES30.glUseProgram(backgroundProgram)\n        if (backgroundUniformFrom != fromIndex || backgroundUniformTo != toIndex) {\n            for (i in 0..2) {\n                uniform3Bg("uBg${i}From", from.background[i])\n                uniform3Bg("uBg${i}To", to.background[i])\n            }\n            backgroundUniformFrom = fromIndex\n            backgroundUniformTo = toIndex\n        }\n        uniform1Bg("uMix", e)\n''',
    'background gradient upload cache',
)
replace_once(
    renderer,
    '        commonUniformFrom = -1\n        commonUniformTo = -1\n        transitionStartNs = nowNs\n',
    '        commonUniformFrom = -1\n        commonUniformTo = -1\n        backgroundUniformFrom = -1\n        backgroundUniformTo = -1\n        transitionStartNs = nowNs\n',
    'invalidate background cache on target change',
)
replace_once(
    service,
    '        if (!force && elapsed < 3_000_000_000L) return\n',
    '        if (!force) return\n',
    'publish diagnostics only when wallpaper hides',
)

text = guard.read_text()
text = text.replace(
    '    "GLES30.glDisable(GLES30.GL_BLEND)",\n',
    '    "GLES30.glDisable(GLES30.GL_BLEND)",\n    "backgroundUniformFrom",\n',
)
text = text.replace(
    '    "SystemClock.sleep",\n',
    '    "SystemClock.sleep",\n    "if (!force && elapsed",\n',
)
guard.write_text(text)

print('Android Betta performance audit finalization applied')
