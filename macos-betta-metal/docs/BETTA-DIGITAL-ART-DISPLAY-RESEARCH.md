# BETTA Digital Art Display Research

## Decision

The easiest premium experience should be a dedicated **Display Art** mode, separate from the existing desktop/wallpaper-style mode.

The consumer flow should be:

**Choose a Betta → Display Art → choose a display once → artwork fills that display.**

After the first choice, BETTA remembers the target display so the primary action becomes genuinely one-click.

## Why this is the best primary display feature

### 1. Native full-display presentation is simpler than wallpaper plumbing

AppKit supports borderless windows specifically for display-style uses. BETTA can create a borderless native Metal window at the selected `NSScreen.frame`, render the existing organism directly, hide all creative controls, and exit cleanly without changing the user's macOS wallpaper.

Apple references:
- https://developer.apple.com/documentation/appkit/nswindow/stylemask-swift.struct/borderless
- https://developer.apple.com/documentation/appkit/nswindow/init(contentrect:stylemask:backing:defer:screen:)

### 2. It works especially well with an external display

A dedicated external display can become a digital frame while the user continues working normally on the built-in display. We do not need global kiosk restrictions for this case. BETTA can create one renderer/window for the selected screen and leave the rest of macOS alone.

`NSApplication.didChangeScreenParametersNotification` lets BETTA react when a monitor is connected, disconnected, rotated, or reconfigured.

Apple reference:
- https://developer.apple.com/documentation/appkit/nsapplication/didchangescreenparametersnotification

### 3. Fullscreen chrome can disappear without locking the Mac down

For the primary display, AppKit presentation options can hide or auto-hide the Dock and menu bar. We should not disable app switching, Force Quit, or other system escape routes. The digital-art experience should be immersive, not kiosk-hostile.

Apple reference:
- https://developer.apple.com/documentation/appkit/nsapplication/presentationoptions-swift.struct

### 4. “Keep Display Awake” can be an explicit display option

Foundation's `ProcessInfo.ActivityOptions.idleDisplaySleepDisabled` can keep the display powered while the user intentionally runs Display Art. This should be opt-in, visible, and automatically released when Display Art stops.

Apple reference:
- https://developer.apple.com/documentation/foundation/processinfo/activityoptions

## Why not make system wallpaper the primary experience

`NSWorkspace.setDesktopImageURL` is a public API, but it accepts an image file. It is appropriate for static snapshots, not BETTA's continuous native Metal organism.

Apple reference:
- https://developer.apple.com/documentation/appkit/nsworkspace/setdesktopimageurl(_:for:options:)

The existing BETTA desktop mode is therefore still useful: it renders a desktop-level native Metal window rather than pretending a static-image API can host the living renderer. It should remain a separate option named **Use on Desktop**.

## Why not make Screen Saver the first display path

Apple still documents the Screen Saver framework and `.saver` bundles with `ScreenSaverView`, so a true system screen saver is possible as a separate distribution artifact. But it adds installation/distribution/state-sharing complexity and is not the lowest-friction way to simply show art now.

Apple reference:
- https://developer.apple.com/documentation/screensaver

A `.saver` can remain a later companion feature after Display Art is proven.

## Recommended consumer UX

### Living Gallery

Primary actions should become:

1. **Display Art** — strongest/primary CTA.
2. **Use on Desktop** — persistent living desktop.
3. **Customize in Living Studio** — advanced creation.

Random, Favorite, and Evolve remain compact secondary controls.

### First Display Art launch

If there is one screen, enter Display Art immediately.

If there are multiple screens, show a tiny native picker only once:
- Built-in Display
- named external displays using `NSScreen.localizedName`
- All Displays

Remember the selection. The next press is one-click.

### While displaying

The art should have no permanent interface.

- Cursor hides after a short idle delay.
- Move the pointer to reveal a small Liquid Glass strip.
- Minimal controls: Previous, Next, Random, Favorite, Exit.
- Escape always exits.
- Menu-bar item also exposes **Stop Display Art**.
- No titles, FPS, diagnostics, or settings over the artwork.

### Display Art modes

Keep the choice understandable rather than technical:
- **Current** — the selected exact Betta.
- **Favorites Flow** — slowly rotates saved Favorites.
- **Evolve** — Continuous Evolution.
- **Bangkok Live** — current Betta plus Himawari environmental mood.

A user should not need to understand membranes, shaders, or satellite data to display the work.

## Multi-display behavior

Recommended defaults:

- A single selected display gets one full-quality native Metal renderer.
- **All Displays** mirrors the same organism/environment unless the user explicitly chooses independent art later.
- Reuse the existing shared stores and Himawari environment so there is only one creative/environmental authority.
- Rebuild display surfaces on `didChangeScreenParametersNotification`.
- Preserve composition per display/aspect ratio without altering saved Studio composition.

## Keep Display Awake

Expose one simple toggle in Display settings:

**Keep display awake while showing art**

Recommended behavior:
- default OFF on a battery-powered built-in display;
- remember the user's choice;
- only request `idleDisplaySleepDisabled`, not broad system-sleep prevention;
- release the activity token immediately when Display Art ends.

## Product language

Prefer:
- Display Art
- Stop Display Art
- Choose Display
- Keep Display Awake
- Current / Favorites Flow / Evolve / Bangkok Live

Avoid making “wallpaper” the umbrella term. Wallpaper is only one destination. BETTA is better positioned as living digital art that can appear on the desktop, on a dedicated display, and later as a screen saver.

## Market observations

Current macOS wallpaper/art products repeatedly emphasize:
- menu-bar-first controls;
- one-click application;
- multi-monitor support;
- pausing when artwork is hidden;
- low resource use;
- no account/subscription friction where possible.

These patterns support making Display Art immediate and invisible rather than adding another settings-heavy mode.

Examples reviewed:
- Atheria help: https://atheria.app/help
- EaselWall Mac App Store listing: https://apps.apple.com/us/app/easelwall/id6778701883
- Recent community discussions around Muro, Wallper, WallD, and other live-wallpaper apps.

## Recommended implementation order

### Phase A — Display Art MVP
- Borderless window on selected `NSScreen`.
- Reuse current Metal renderer/state.
- Escape exits.
- Cursor auto-hide.
- Remember target display.
- Optional Keep Display Awake.
- Menu-bar Start/Stop Display Art.

### Phase B — premium interaction
- Auto-hidden Liquid Glass transport controls.
- Current / Favorites Flow / Evolve / Bangkok Live.
- Auto-start Display Art when a chosen external monitor connects.

### Phase C — companion destinations
- True `.saver` artifact if desired.
- Optional static snapshot export / static wallpaper setter.
- Commercial signing/notarization polish.

## Recommendation

Build **Display Art MVP next**. It offers the highest perceived value for the least architectural risk because it reuses BETTA's strongest asset — the stable native Metal renderer — and removes setup steps instead of adding new technology.
