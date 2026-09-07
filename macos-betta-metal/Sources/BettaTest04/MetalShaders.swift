import Foundation

/// The Deformation Stack and Material Mapping primitives, in MSL.
///
/// Held as a Swift string rather than a `.metal` resource because this machine
/// has no offline Metal compiler (`xcrun metal` is absent without full Xcode),
/// so the library is built at runtime with `makeLibrary(source:)` - the same
/// fallback path `BettaRenderer.swift` already carries.
///
/// An original implementation written for this test. Studied from the locked
/// engine, not ported from it.
///
/// Honest note about the literals below: coefficients such as the edge-shape
/// exponent or the transmission mix are appearance decisions living in the
/// *primitive*. The protocol's line is that the constitution owns ranges and
/// the *generator* owns nothing; a primitive still defines how it draws. That
/// line is defensible but not free, and these literals are exactly the sort of
/// thing that became "44 numeric literals" in the engine under test. Recorded
/// rather than hidden.
let membraneShaderSource = """
#include <metal_stdlib>
using namespace metal;

struct Uniforms {
    float spread;
    float foldDensity;
    float curl;
    float twist;
    float edgeFlutter;
    float depth;
    float phase;
    float amplitude;
    float turbulence;
    float currentStrength;
    float opacity;
    float transmission;
    float rimStrength;
    float bloom;
    float baseR;
    float baseG;
    float baseB;
    float accentR;
    float accentG;
    float accentB;
};

struct VertexOut {
    float4 position [[position]];
    float fold;
    float tip;
};

static inline float hash21(float2 p) {
    p = fract(p * float2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

static inline float valueNoise(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + float2(1.0, 0.0));
    float c = hash21(i + float2(0.0, 1.0));
    float d = hash21(i + float2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vertex VertexOut membraneVertex(uint vid [[vertex_id]],
                                const device float2 *uvs [[buffer(0)]],
                                constant Uniforms &u [[buffer(1)]],
                                constant float4x4 &mvp [[buffer(2)]]) {
    float2 uv = uvs[vid];
    float uu = uv.x;
    float vv = uv.y;

    float theta = (vv - 0.5) * u.spread;

    float n1 = valueNoise(float2(uu * 3.0, vv * 4.0 + u.phase * 0.6)) - 0.5;
    float n2 = valueNoise(float2(uu * 7.0 + 4.1, vv * 9.0 - u.phase * 0.9)) - 0.5;

    theta += u.curl * uu * uu + u.twist * uu * n1 * u.turbulence;
    theta += n2 * u.currentStrength * uu;

    float edgeShape = 1.0 - 0.15 * pow(abs(vv - 0.5) * 2.0, 2.0);
    float radius = uu * 1.1 * edgeShape;

    float fold = sin(vv * u.foldDensity * 6.28318 + u.phase) * u.depth * 0.25 * uu;
    float flutter = n1 * u.edgeFlutter * smoothstep(0.6, 1.0, uu);
    float breathing = sin(u.phase * 0.5) * u.amplitude * 0.15 * uu * uu;

    float3 pos = float3(cos(theta) * radius, sin(theta) * radius, fold + flutter + breathing);

    VertexOut out;
    out.position = mvp * float4(pos, 1.0);
    out.fold = clamp(abs(fold) / max(u.depth * 0.25, 0.001), 0.0, 1.0);
    out.tip = smoothstep(0.5, 1.0, uu);
    return out;
}

fragment float4 membraneFragment(VertexOut in [[stage_in]],
                                 constant Uniforms &u [[buffer(1)]]) {
    float3 baseColor = float3(u.baseR, u.baseG, u.baseB);
    float3 accentColor = float3(u.accentR, u.accentG, u.accentB);

    float3 base = mix(baseColor, accentColor, in.tip);
    float rim = pow(in.tip, 2.0) * u.rimStrength * 0.4;
    float3 lit = base * (0.55 + 0.45 * u.transmission)
               + base * in.fold * 0.3
               + accentColor * rim * u.bloom;

    float alpha = u.opacity * (0.7 + 0.3 * in.fold);
    return float4(lit, clamp(alpha, 0.0, 1.0));
}
"""
