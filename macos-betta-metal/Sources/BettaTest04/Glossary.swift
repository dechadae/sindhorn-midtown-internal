import Foundation

/// What the translator is told about the engine.
///
/// The model never sees the shader. It sees this: every number it may set,
/// one line on what that number does, and the range the explorer's own
/// constitution samples from - quoted as *typical*, explicitly not a limit,
/// because the studio's whole point is that intent may leave the constitution
/// while it may never leave the gamut.
///
/// The ranges are read from the constitution at build time rather than typed
/// here, so the brief cannot go stale when a constitution changes. The
/// sentences are written by hand, because "what this number does" is not
/// something the constitution knows.
///
/// The notes at the end are facts about the engine that cost real time to
/// find. They are here so the next translator does not have to find them
/// again - a model asked for "deeper blue" will reach for saturation, and on
/// a transmissive membrane that does almost nothing.
enum Glossary {
    static let describes: [String: String] = [
        // Palette
        "baseHueDeg": "Hue of the organism's first two palette stops, 0-360. 0 red, 120 green, 210 blue, 280 violet, 330 pink.",
        "accentHueDeg": "Hue of the last two stops, 0-360. The organism reads as two hue families meeting; the distance between this and baseHueDeg is how far apart they read.",
        "saturation": "Colour strength of the base stops, 0-1. Note it has little authority where transmission is high.",
        "accentSaturationScale": "Multiplies saturation for the accent stops, 0-1. Below 1 the accent is the quieter half.",
        "lightness0": "Darkest palette stop, 0-1. Where folds fall to.",
        "lightness1": "Second stop, 0-1.",
        "lightness2": "Third stop, 0-1.",
        "lightness3": "Lightest stop, 0-1. Where the light catches, and what metallic mode mixes toward.",
        // Ground
        "groundHueDeg": "Hue of the ground's middle stop, 0-360. The ground is three stops: this minus half the spread, this, this plus half the spread.",
        "groundHueSpreadDeg": "How far the ground's two end stops sit either side of the middle hue. Small is one colour; 150+ crosses the wheel.",
        "groundSaturation": "Colour strength of the ground, 0-1. Under about 0.2 the ground reads as paper.",
        "groundLightnessA": "Lightness of the first ground stop, 0-1. The deeper of the two ends wins the frame.",
        "groundLightnessB": "Lightness of the last ground stop, 0-1.",
        "groundMidBias": "Where the middle stop's lightness sits between A and B, 0-1. Hue is unaffected.",
        "groundCenterX": "Horizontal centre of the ground gradient, 0-1.",
        "groundCenterY": "Vertical centre of the ground gradient, 0-1.",
        "groundSweepAngleDeg": "Direction the ground gradient runs, 0-360.",
        "groundVignette": "Darkening toward the corners, 0-1. Small values read photographic.",
        // Form
        "spread": "How far the membrane fans open, in radians up to about 2pi. Wide values reach both edges of the frame.",
        "foldDensity": "Number of folds across the sheet. More folds means more of the sheet crossing itself, which deepens colour where it overlaps.",
        "curl": "Curl along the sheet's length, about -2 to 2.",
        "twist": "Twist about the body axis, about -2 to 2.",
        "edgeFlutter": "Low-frequency waviness of the outer edge, 0-0.5.",
        "depth": "How far the sheet extends away from the viewer, 0-1.5.",
        // Motion
        "motionSpeed": "Speed of the whole animation, 0-1. Slow means low speed with high amplitude - one long travelling wave.",
        "motionAmplitude": "How far the sheet travels as it moves, 0-1.",
        "turbulence": "Irregularity of the motion, 0-1. Wind is a little irregular; water is not.",
        "currentStrength": "A steady directional drift, 0-1, so the motion has a direction to come from.",
        // Material
        "opacity": "How much of the surface is there at all, strictly between 0 and 1. This is the main translucency dial.",
        "transmission": "How much light passes through, strictly between 0 and 1. High transmission means the ground behind drives the colour.",
        "rimStrength": "Light gathering along edges, 0-3.",
        "foldHighlight": "Light gathering along folds, 0-3. This is what reads as sheen on cloth.",
        "iridescence": "Colour-channel rotation at edges and folds, 0-1. At 1 the edges go rainbow.",
        "bloom": "A soft warm glow added at the lit edges, 0-1.",
        // Grading
        "gradingSaturation": "Saturation applied to the finished image, 0-3.",
        "brightness": "Exposure of the finished image, 0-3. Above about 1.8 pale palettes blow out to white.",
        "gradientPosition": "Shifts where the palette sits across the form, about -0.5 to 0.5.",
        // Detail
        "rayCount": "How many rays the membrane is built from. Low counts leave visible teeth along a silhouette; high counts read as a fine hem.",
        "microFold": "Fine folding on top of the main folds, 0-1.",
        "rayDefinition": "How distinct each ray is, 0-1.",
        "edgeRuffle": "High-frequency frilling of the outer edge, 0-1. Zero is a smooth hem.",
        "veinStrength": "Visible veining through the membrane, 0-1. Veins read as living tissue rather than cloth.",
        "membraneGrain": "Fine grain across the surface, 0-1.",
        "fineFlutter": "Fine flutter along the edge, 0-1.",
        "normalDetail": "How much the surface's fine relief catches light, 0-1.",
        // Layers
        "backScale": "Size of the second membrane relative to the front one, 0-1.5.",
        "backAlpha": "Opacity of the back membrane, 0-1. Raising it toward frontAlpha makes the two read as separate sheets.",
        "frontAlpha": "Opacity of the front membrane, 0-1.",
        "phaseOffset": "How far out of step the two membranes are, 0-60. Large values stop them reading as one doubled edge.",
        "seedOffset": "How differently the second membrane is shaped, 0-20.",
        // Whole organism
        "morphMode": "Which colour treatment the shader uses: 0 plain, 1 koi, 2 pearl-red, 3 alternate gradient, 4 ridge tint (sheen along folds), 5 metallic (mixes toward lightness3 by fresnel).",
        "presenceScale": "How oversized the organism is. The rule is dominant or departed: it should fill the frame and leave it, never sit small in the middle.",
        "exitDistance": "How far out of frame the organism has travelled. 0 is present; 7-13 is gone, leaving the ground as the picture.",
    ]

    /// Hard-won facts about how these numbers behave together.
    static let notes: [String] = [
        "A patch sets only the fields it names. An omitted field keeps the value the seed gave it - there is no way to say 'none', only a value.",
        "Where transmission is high, palette saturation has very little authority: the visible colour is mostly the ground seen through the sheet. To deepen a translucent colour, raise foldDensity so the sheet overlaps itself more, or darken the ground.",
        "A silhouette seen nearly edge-on shows the ray tips as teeth. edgeRuffle, edgeFlutter and fineFlutter do not remove them; raising rayCount well past the constitution's range makes them fine enough to read as a hem.",
        "opacity and transmission must both stay strictly inside 0 and 1 or contract T3 fails: fully opaque or fully invisible is a broken picture, not a style.",
        "The four palette lightness stops must span at least 0.08 (T5), and the two ground lightnesses at least 0.05 (T6).",
        "The crop is never yours to set. The eight locked compositions belong to the owner and the studio only chooses among them.",
        "A patch may leave the constitution's typical ranges - that is the studio's purpose - but every value must stay in gamut: hues 0-360, all saturations and lightnesses 0-1.",
    ]

    /// The brief, as the model receives it.
    static func build(constitution c: Constitution) -> [String: Any] {
        // The bounds a value is sampled from, by field name. Not a limit -
        // the label says so, and the studio prints departures rather than
        // refusing them.
        let p = c.palette, g = c.ground, f = c.form, m = c.motion
        let mat = c.material, gr = c.grading, d = c.detail, l = c.layers
        let typical: [String: Bounds] = [
            "saturation": p.saturation, "accentSaturationScale": p.accentSaturationScale,
            "lightness0": p.lightness0, "lightness1": p.lightness1,
            "lightness2": p.lightness2, "lightness3": p.lightness3,
            "groundHueSpreadDeg": g.hueSpreadDeg, "groundSaturation": g.saturation,
            "groundMidBias": g.midBias, "groundCenterX": g.centerX,
            "groundCenterY": g.centerY, "groundVignette": g.vignette,
            "spread": f.spread, "foldDensity": f.foldDensity, "curl": f.curl,
            "twist": f.twist, "edgeFlutter": f.edgeFlutter, "depth": f.depth,
            "motionSpeed": m.speed, "motionAmplitude": m.amplitude,
            "turbulence": m.turbulence, "currentStrength": m.currentStrength,
            "opacity": mat.opacity, "transmission": mat.transmission,
            "rimStrength": mat.rimStrength, "foldHighlight": mat.foldHighlight,
            "iridescence": mat.iridescence, "bloom": mat.bloom,
            "gradingSaturation": gr.saturation, "brightness": gr.brightness,
            "gradientPosition": gr.gradientPosition,
            "rayCount": d.rayCount, "microFold": d.microFold,
            "rayDefinition": d.rayDefinition, "edgeRuffle": d.edgeRuffle,
            "veinStrength": d.veinStrength, "membraneGrain": d.membraneGrain,
            "fineFlutter": d.fineFlutter, "normalDetail": d.normalDetail,
            "backScale": l.backScale, "backAlpha": l.backAlpha,
            "frontAlpha": l.frontAlpha, "phaseOffset": l.phaseOffset,
            "seedOffset": l.seedOffset,
        ]

        var fields: [[String: Any]] = []
        for name in Studio.fields.keys.sorted() {
            var entry: [String: Any] = [
                "name": name,
                "does": describes[name] ?? "",
            ]
            if let bounds = typical[name] {
                entry["typical"] = [bounds.min, bounds.max]
            }
            fields.append(entry)
        }

        return [
            "version": c.version,
            "_": "Typical ranges are what the explorer's constitution samples. They are NOT limits. A studio patch may leave them; it may never leave the gamut.",
            "fields": fields,
            "parts": [
                "_": "Optional. Replaces the rigid parts accompanying the membrane.",
                "primitives": FormPrimitive.allCases.map(\.rawValue),
                "keys": ["primitive", "scale", "orbitRadius", "orbitAngleDeg", "tiltDeg", "phaseOffset"],
            ],
            "contracts": [
                "T1": "every number finite",
                "T2": "hues 0-360; saturations and lightnesses 0-1",
                "T3": "opacity and transmission strictly inside (0,1)",
                "T4": "outside the constitution - reported, not refused",
                "T5": "palette lightness spread at least 0.08",
                "T6": "ground lightness difference at least 0.05",
            ],
            "notes": notes,
        ]
    }
}
