import Foundation

/// Four rigid form primitives, appended to the engine's shader source at
/// compile time. The engine's file is never modified.
///
/// Each emits the engine's own `FinVertexOut` and is drawn with the engine's
/// own `finFragment`, so all five forms share one material - the same palette
/// mapping, morph modes, rim, iridescence, grain and grading. That is what
/// makes them read as one organism rather than four objects sharing a canvas:
/// different topology, one skin.
///
/// The frozen protocol predicted this shape of change (Q03): a rigid family
/// beside the membrane needs a **new primitive**, not a new parameter -
/// different topology, not a deformation. These are those primitives. They are
/// additive; the membrane is untouched.
let shapeShaderAppendix = """

// ---------------------------------------------------------------------------
// Test 04 rigid primitives. Additive: nothing above this line is changed.
// ---------------------------------------------------------------------------

/// Shared drift so every part of the organism moves on one current, with a
/// per-part offset. A creature moves as a whole.
static inline float3 t04_drift(float u, float v, constant FinUniforms& f, float partPhase) {
    float t = f.timeSeedPhaseMorph.x * f.shape1.w + partPhase;
    float amp = f.shape2.y;
    float turb = f.shape2.x;
    return float3(
        sin(t * 0.7 + v * 3.1) * amp * 0.16,
        cos(t * 0.6 + u * 2.3) * amp * 0.14,
        sin(t * 0.9 + (u + v) * 4.1) * turb * 0.22
    );
}

/// PRISM - a faceted fan. The angle is quantised so each facet is planar and
/// meets its neighbour on a hard edge, which is the opposite of the membrane's
/// continuous sweep.
static inline float3 t04_prismPosition(float u, float v, float jitter, constant FinUniforms& f) {
    float facets = clamp(floor(f.detail0.x * 0.11), 5.0, 14.0);
    float fv = floor(v * facets) / facets;
    float theta = (fv - 0.5) * f.shape0.x;
    theta += f.shape0.z * u * u * 0.45;

    float lengthVary = 1.0 + jitter * 0.10;
    float r = u * 3.05 * lengthVary;
    float z = (fv - 0.5) * f.shape1.y * 1.35 + sin(fv * 7.0) * f.shape1.y * 0.30 * u;

    return float3(cos(theta) * r, sin(theta) * r, z) + t04_drift(u, v, f, 0.0);
}

/// DIAMOND - a faceted spindle. Radius peaks at mid-length and closes to a
/// point at both ends, so the silhouette is crystalline rather than fanned.
static inline float3 t04_diamondPosition(float u, float v, float jitter, constant FinUniforms& f) {
    float facets = clamp(floor(f.detail0.x * 0.09), 4.0, 10.0);
    float fv = floor(v * facets) / facets;
    float theta = fv * 6.28318;

    float profile = sin(clamp(u, 0.0, 1.0) * 3.14159265);
    float r = profile * 1.85 * (1.0 + jitter * 0.08);
    float z = (u - 0.5) * 4.4 * (0.55 + f.shape1.y * 0.55);
    r *= 1.0 + f.shape0.w * 0.18 * sin(fv * 12.0);

    return float3(cos(theta) * r, sin(theta) * r, z) + t04_drift(u, v, f, 1.7);
}

/// RING - an annulus. A closed band with a hole through it: the only one of the
/// five with a topology the membrane cannot reach by deformation.
static inline float3 t04_ringPosition(float u, float v, float jitter, constant FinUniforms& f) {
    float theta = v * 6.28318;
    float phi = u * 6.28318;

    float major = 2.05 + sin(theta * 3.0) * f.shape2.x * 0.35;
    float minor = 0.52 * (1.0 + jitter * 0.16) * (0.7 + f.shape1.y * 0.6);

    float ripple = sin(theta * clamp(f.shape0.y, 4.0, 16.0) + phi) * f.shape1.x * 1.1;
    float radius = major + (minor + ripple) * cos(phi);

    return float3(
        cos(theta) * radius,
        sin(theta) * radius,
        (minor + ripple) * sin(phi)
    ) + t04_drift(u, v, f, 3.4);
}

/// RIBBON - a narrow strip that twists along its length. Directional where the
/// others are radial.
static inline float3 t04_ribbonPosition(float u, float v, float jitter, constant FinUniforms& f) {
    float along = (v - 0.5) * 5.6;
    float across = (u - 0.5) * 0.62 * (1.0 + jitter * 0.20);

    float twist = v * (2.2 + f.shape0.w * 3.4) * 3.14159265
                + f.timeSeedPhaseMorph.z * 0.25;
    float bend = sin(v * 3.14159265) * f.shape0.z * 1.5;

    float3 p = float3(
        along,
        across * cos(twist) + bend,
        across * sin(twist)
    );
    // Curve the whole ribbon so it wraps toward the body rather than running
    // straight past it.
    p.x += sin(v * 3.14159265) * 0.6;
    return p + t04_drift(u, v, f, 5.1);
}

#define T04_SHAPE_VERTEX(NAME, POSFN)                                          \\
vertex FinVertexOut NAME(FinVertexIn in [[stage_in]],                          \\
                         constant FinUniforms& f [[buffer(1)]]) {              \\
    FinVertexOut out;                                                          \\
    float3 p = POSFN(in.u, in.v, in.rayJitter, f);                             \\
    float e = 0.0035;                                                          \\
    float3 pu = POSFN(min(1.0, in.u + e), in.v, in.rayJitter, f)               \\
              - POSFN(max(0.0, in.u - e), in.v, in.rayJitter, f);              \\
    float3 pv = POSFN(in.u, min(1.0, in.v + e), in.rayJitter, f)               \\
              - POSFN(in.u, max(0.0, in.v - e), in.rayJitter, f);              \\
    float3 n = normalize(cross(pu, pv) + float3(0.0, 0.0, 1e-5));              \\
    float4 world = f.modelMatrix * float4(p, 1.0);                             \\
    float3x3 model3 = float3x3(f.modelMatrix[0].xyz,                           \\
                               f.modelMatrix[1].xyz,                           \\
                               f.modelMatrix[2].xyz);                          \\
    out.worldPos = world.xyz;                                                  \\
    out.normal = normalize(model3 * n);                                        \\
    out.finUv = float2(in.u, in.v);                                            \\
    out.ray = abs(sin((in.v * max(24.0, f.detail0.x) + in.rayJitter * .12)     \\
                      * 3.14159265));                                          \\
    out.fold = clamp(abs(p.z) / max(f.shape1.y, .05) * .9, 0.0, 1.0);          \\
    float sideEdge = pow(abs(in.v - .5) * 2.0, 6.0);                           \\
    out.edge = max(smoothstep(.78, 1.0, in.u), sideEdge);                      \\
    out.position = f.viewProjectionMatrix * world;                             \\
    return out;                                                                \\
}

T04_SHAPE_VERTEX(t04PrismVertex, t04_prismPosition)
T04_SHAPE_VERTEX(t04DiamondVertex, t04_diamondPosition)
T04_SHAPE_VERTEX(t04RingVertex, t04_ringPosition)
T04_SHAPE_VERTEX(t04RibbonVertex, t04_ribbonPosition)
"""

/// The five form primitives. The membrane is the engine's; the other four are
/// Test 04's, and each is a distinct topology rather than a deformation.
enum FormPrimitive: String, CaseIterable, Codable {
    case membrane
    case prism
    case diamond
    case ring
    case ribbon

    var vertexFunction: String {
        switch self {
        case .membrane: return "finVertex"
        case .prism: return "t04PrismVertex"
        case .diamond: return "t04DiamondVertex"
        case .ring: return "t04RingVertex"
        case .ribbon: return "t04RibbonVertex"
        }
    }

    /// The rigid family, in the order a seed adds them.
    static let rigid: [FormPrimitive] = [.prism, .diamond, .ring, .ribbon]
}
