#include <metal_stdlib>
using namespace metal;

// Runtime-safe High Detail kernel.
// It keeps the full editor/uniform contract but intentionally uses cheap
// analytic folds instead of the very large nested simplex-noise graph.
// This is designed to be easy for Apple GPU runtime pipeline specialization.

struct FinUniforms {
    float4x4 modelMatrix;
    float4x4 viewProjectionMatrix;
    float4 cameraPosition;
    float4 timeSeedPhaseMorph;
    float4 shape0;
    float4 shape1;
    float4 shape2;
    float4 lighting;
    float4 grading;
    float4 modes;
    float4 satelliteA;
    float4 satelliteB;
    float4 satelliteC;
    float4 fingerprint;
    float4 detail0; // rayCount, microFold, rayDefinition, edgeRuffle
    float4 detail1; // veinStrength, membraneGrain, fineFlutter, normalDetail
    float4 color0From;
    float4 color1From;
    float4 color2From;
    float4 color3From;
    float4 color0To;
    float4 color1To;
    float4 color2To;
    float4 color3To;
};

struct BackgroundUniforms {
    float4 bg0From; float4 bg1From; float4 bg2From;
    float4 bg0To; float4 bg1To; float4 bg2To;
    float4 satelliteColorMix; float4 transition;
};

struct FinVertexIn {
    float u [[attribute(0)]];
    float v [[attribute(1)]];
    float rayJitter [[attribute(2)]];
};

struct FinVertexOut {
    float4 position [[position]];
    float2 finUv;
    float3 worldPos;
    float3 normal;
    float ray;
    float fold;
    float edge;
};

struct BackgroundVertexOut {
    float4 position [[position]];
    float2 uv;
};

inline float hash21(float2 p) {
    p = fract(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

inline float valueNoise(float2 p) {
    float2 i = floor(p);
    float2 q = fract(p);
    q = q * q * (3.0 - 2.0 * q);
    float a = hash21(i);
    float b = hash21(i + float2(1.0, 0.0));
    float c = hash21(i + float2(0.0, 1.0));
    float d = hash21(i + float2(1.0, 1.0));
    return mix(mix(a, b, q.x), mix(c, d, q.x), q.y);
}

inline float3 membranePosition(float u, float v, float jitter, constant FinUniforms& f) {
    const float TAU = 6.28318530718;
    float time = f.timeSeedPhaseMorph.x;
    float seed = f.timeSeedPhaseMorph.y;
    float phase = f.timeSeedPhaseMorph.z;

    float spread = f.shape0.x;
    float foldDensity = f.shape0.y;
    float curl = f.shape0.z;
    float twistAmount = f.shape0.w;
    float edgeFlutter = f.shape1.x;
    float depth = f.shape1.y;
    float currentStrength = f.shape1.z;
    float motionSpeed = f.shape1.w;
    float turbulence = f.shape2.x;
    float motionAmplitude = f.shape2.y;

    float rayCount = max(24.0, f.detail0.x);
    float microFold = f.detail0.y;
    float rayDefinition = f.detail0.z;
    float edgeRuffle = f.detail0.w;
    float fineFlutter = f.detail1.z;

    float t = time * motionSpeed + phase;
    float rootEase = smoothstep(.02, .24, u);
    float tipEase = smoothstep(.50, 1.0, u);
    float theta = (v - .5) * spread;

    // Large silk folds + slow organism drift. All analytic so runtime compile is small.
    float broad = sin(v * TAU * 2.17 + t * .31 + seed * .071)
                + .45 * sin(v * TAU * 4.31 - t * .19 + seed * .113);
    broad /= 1.45;
    float longitudinal = sin(u * TAU * 1.35 - t * .23 + v * 5.1 + seed * .043);
    float cross = sin((u * 3.7 + v * 7.9) * TAU + t * .37 + seed * .019);

    float currentWave = sin(t * .27 + seed * .11) * currentStrength;
    theta += curl * u * u * (.50 + broad * .10);
    theta += broad * motionAmplitude * .105 * rootEase;
    theta += currentWave * u * u * .08;

    float edgeShape = 1.0 - .16 * pow(abs(v - .5) * 2.0, 2.3);
    float rayPhase = v * rayCount * TAU + seed * .031 + jitter * .18;
    float rayWave = sin(rayPhase);
    float rayFine = sin(rayPhase * 2.03 + u * 10.0 + t * .45);
    float scallop = .022 * sin(v * 19.0 * TAU + seed)
                  + .010 * sin(v * 41.0 * TAU - seed * .4)
                  + edgeRuffle * tipEase * (.008 * rayWave + .004 * rayFine);
    float rayLength = (1.0 + jitter * .105 + scallop) * edgeShape;
    float r = u * 3.55 * rayLength;
    r *= 1.0 + broad * .035 * rootEase;
    r *= 1.0 + rayWave * (.003 + .005 * u) * rayDefinition * rootEase;

    float foldPhase = v * foldDensity * TAU + t * .56 + seed + longitudinal * .22;
    float fold = sin(foldPhase) * (.26 + .50 * u);
    float twist = twistAmount * u * u + broad * turbulence * .18;

    float3 p = float3(cos(theta), sin(theta), 0.0) * r;
    float thickness = sin(theta * 1.7 + twist) * depth * u * .22;
    p.z += thickness + fold * depth * .34 * rootEase;
    p.z += (broad * .28 + longitudinal * .15 + cross * .08 * turbulence) * motionAmplitude * rootEase * (.4 + .6 * u);

    // High-detail controls stay functional but are inexpensive.
    p.z += rayWave * depth * (.008 + .014 * u) * microFold * rootEase;
    p.z += rayFine * depth * .0045 * microFold * rootEase * tipEase;
    float fine = sin(rayPhase * 1.71 + u * 21.0 + t * 1.85);
    p.z += fine * fineFlutter * edgeFlutter * tipEase * tipEase * .035;

    float tangentX = -sin(theta);
    float tangentY = cos(theta);
    p.xy += float2(tangentX, tangentY) * rayWave * rayDefinition * u * .0035 * rootEase;
    p.xy += float2(tangentX, tangentY) * sin(t * .21 + seed) * currentStrength * u * u * .025;

    float flutter = sin(u * 19.0 + v * 31.0 + t * 2.0 + seed * .17);
    p.z += flutter * edgeFlutter * tipEase * tipEase * .14;
    p.xy += float2(tangentX, tangentY) * flutter * edgeFlutter * tipEase * .045;

    float ct = cos(twist), st = sin(twist);
    float oy = p.y, oz = p.z;
    p.y = ct * oy + st * oz;
    p.z = -st * oy + ct * oz;
    return p;
}

vertex FinVertexOut finVertex(FinVertexIn in [[stage_in]], constant FinUniforms& f [[buffer(1)]]) {
    FinVertexOut out;
    float3 p = membranePosition(in.u, in.v, in.rayJitter, f);

    // Stable finite-difference normal. Dense 160x144 topology supplies the smoothness.
    const float eU = .0045;
    const float eV = .0035;
    float3 pu = membranePosition(min(1.0, in.u + eU), in.v, in.rayJitter, f)
              - membranePosition(max(0.0, in.u - eU), in.v, in.rayJitter, f);
    float3 pv = membranePosition(in.u, min(1.0, in.v + eV), in.rayJitter, f)
              - membranePosition(in.u, max(0.0, in.v - eV), in.rayJitter, f);
    float3 n = normalize(cross(pu, pv));

    float4 world = f.modelMatrix * float4(p, 1.0);
    float3x3 model3 = float3x3(f.modelMatrix[0].xyz, f.modelMatrix[1].xyz, f.modelMatrix[2].xyz);
    out.worldPos = world.xyz;
    out.normal = normalize(model3 * n);
    out.finUv = float2(in.u, in.v);
    out.ray = abs(sin((in.v * max(24.0, f.detail0.x) + in.rayJitter * .12) * 3.14159265));
    out.fold = clamp(abs(p.z) / max(f.shape1.y, .05) * .9, 0.0, 1.0);
    float sideEdge = pow(abs(in.v - .5) * 2.0, 6.0);
    out.edge = max(smoothstep(.78, 1.0, in.u), sideEdge);
    out.position = f.viewProjectionMatrix * world;
    return out;
}

inline float3 paletteFor(float t, float3 c0, float3 c1, float3 c2, float3 c3) {
    t = clamp(t, 0.0, 1.0);
    if (t < .34) return mix(c0, c1, t / .34);
    if (t < .70) return mix(c1, c2, (t - .34) / .36);
    return mix(c2, c3, (t - .70) / .30);
}

inline float3 morphBase(float mode, float3 c0, float3 c1, float3 c2, float3 c3,
                        float fresnel, float rayRidge, float2 uv, float gp, float seed) {
    float gradient = clamp(uv.x * .67 + uv.y * .28 + gp + .055 * sin(uv.y * 13.0 + seed), 0.0, 1.0);
    if (mode > 2.5 && mode < 3.5) gradient = clamp(uv.x * .94 + uv.y * .05 + gp, 0.0, 1.0);
    float3 base = paletteFor(gradient, c0, c1, c2, c3);

    if (mode > .5 && mode < 1.5) {
        float p = valueNoise(uv * float2(5.7, 8.6) + float2(seed * .21, -seed * .11));
        float q = valueNoise(uv * float2(17.0, 23.0) + seed * .07);
        base = mix(base, c3, smoothstep(.62, .88, p) * .55);
        base = mix(base, c0 * 1.35, smoothstep(.80, .95, q) * .42);
    } else if (mode > 1.5 && mode < 2.5) {
        float boundary = .59 + (valueNoise(uv * 4.3 + seed * .03) - .5) * .16;
        float redZone = smoothstep(boundary - .055, boundary + .055, uv.x);
        base = mix(mix(c0, c1, clamp(uv.x / .7, 0.0, 1.0)), mix(c2, c3, uv.x), redZone);
    } else if (mode > 3.5 && mode < 4.5) {
        base = mix(base, c3, clamp(rayRidge * .24 + fresnel * .08, 0.0, .28));
    } else if (mode > 4.5 && mode < 5.5) {
        base = mix(base, c3, clamp(fresnel * .30 + rayRidge * .18, 0.0, .34));
    }
    return base;
}

inline float3 saturateColor(float3 c, float s) {
    float l = dot(c, float3(.2126, .7152, .0722));
    return mix(float3(l), c, s);
}

fragment float4 finFragment(FinVertexOut in [[stage_in]], bool frontFacing [[front_facing]], constant FinUniforms& f [[buffer(1)]]) {
    float3 N = normalize(in.normal);
    if (!frontFacing) N = -N;

    float seed = f.timeSeedPhaseMorph.y;
    float rayCount = max(24.0, f.detail0.x);
    float rayDefinition = f.detail0.z;
    float veinStrength = f.detail1.x;
    float membraneGrain = f.detail1.y;
    float normalDetail = f.detail1.w;

    float bump = sin(in.finUv.y * rayCount * 6.28318 + in.finUv.x * 9.0 + seed * .11) * normalDetail * .022;
    N = normalize(N + float3(bump * .30, bump * .17, bump));

    float3 V = normalize(f.cameraPosition.xyz - in.worldPos);
    float nv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(1.0 - nv, 2.1);
    float ridgeExponent = max(2.6, 6.2 - rayDefinition * 1.15);
    float rayRidge = pow(1.0 - in.ray, ridgeExponent);

    float grain = hash21(floor(in.finUv * float2(257.0, 389.0) + seed * 13.0));
    float patch = valueNoise(in.finUv * float2(4.4, 6.8) + float2(seed * .13, seed * .07));

    float3 bf = morphBase(f.modes.x, f.color0From.xyz, f.color1From.xyz, f.color2From.xyz, f.color3From.xyz,
                          fresnel, rayRidge, in.finUv, f.grading.z, seed);
    float3 bt = morphBase(f.modes.y, f.color0To.xyz, f.color1To.xyz, f.color2To.xyz, f.color3To.xyz,
                          fresnel, rayRidge, in.finUv, f.grading.z, seed);
    float3 base = mix(bf, bt, clamp(f.timeSeedPhaseMorph.w, 0.0, 1.0));

    float vein = rayRidge * veinStrength * (.30 + .70 * smoothstep(.06, .90, in.finUv.x));
    base *= 1.0 + (grain - .5) * .045 * membraneGrain;
    base += base * vein * .060;
    base *= .985 + patch * .030;

    float cold = f.satelliteA.x;
    float vapor = f.satelliteA.w;
    float3 satTint = saturateColor(max(f.satelliteC.yzw, float3(.02)), 1.35);
    float satMix = clamp(.035 + f.satelliteB.x * .085 + vapor * .035, 0.0, .17);
    base = mix(base, base * (.78 + satTint * .42), satMix);

    float ir = (fresnel * .65 + in.fold * .35) * f.lighting.z + vapor * .065;
    base = mix(base, base.brg, clamp(ir * .26, 0.0, .32));
    base = saturateColor(base, f.grading.x * (.94 + .12 * f.modes.z)) * f.grading.y;

    float3 la = normalize(float3(-.35, .72, .9));
    float3 lb = normalize(float3(.72, -.28, .55));
    float wa = pow(clamp(dot(N, la) * .5 + .5, 0.0, 1.0), 2.2);
    float wb = pow(clamp(dot(N, lb) * .5 + .5, 0.0, 1.0), 3.0);
    float foldLight = (wa * .72 + wb * .28) * (in.fold * .48 + rayRidge * .68) * f.lighting.y;
    float edgeLight = (fresnel * .7 + in.edge * .3) * f.lighting.x;
    float bio = (grain - .5) * (.030 + .020 * membraneGrain);

    float3 transmitted = base * (.36 + .44 * f.shape2.w + .2 * nv);
    float3 lit = transmitted + base * (foldLight * .42 + edgeLight * .25)
               + float3(1.0, .82, .92) * edgeLight * f.lighting.w * .13;
    lit += satTint * cold * in.fold * .035;
    lit += bio * base;
    lit += base * vein * .030 * wa;

    float membrane = .42 + .35 * (1.0 - f.shape2.w) + .22 * (1.0 - nv);
    float alpha = f.shape2.z * membrane;
    alpha *= .72 + .28 * rayRidge;
    alpha += in.edge * f.shape2.z * .09;
    alpha *= f.grading.w;
    alpha *= 1.0 + (grain - .5) * .025 * membraneGrain;
    alpha = clamp(alpha, 0.0, .86);
    if (alpha < .001) discard_fragment();
    return float4(lit, alpha);
}

vertex BackgroundVertexOut backgroundVertex(uint id [[vertex_id]]) {
    const float2 P[3] = { float2(-1,-1), float2(3,-1), float2(-1,3) };
    BackgroundVertexOut out;
    float2 p = P[id];
    out.uv = p * .5 + .5;
    out.position = float4(p, .999, 1.0);
    return out;
}

inline float srgbChannel(float c) {
    c = max(c, 0.0);
    return c <= .0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - .055;
}

inline float3 linearToSrgb(float3 c) {
    return float3(srgbChannel(c.x), srgbChannel(c.y), srgbChannel(c.z));
}

fragment float4 backgroundFragment(BackgroundVertexOut in [[stage_in]], constant BackgroundUniforms& b [[buffer(0)]]) {
    float2 p = in.uv;
    float e = b.transition.x;
    float3 c0 = mix(b.bg0From.xyz, b.bg0To.xyz, e);
    float3 c1 = mix(b.bg1From.xyz, b.bg1To.xyz, e);
    float3 c2 = mix(b.bg2From.xyz, b.bg2To.xyz, e);
    float radial = smoothstep(.06, 1.0, length((p - float2(.61,.36)) * float2(.82,1.04)));
    float sweep = smoothstep(.18, .94, p.x * .62 + (1.0 - p.y) * .38);
    float3 bg = mix(c0, c1, clamp(radial * .74 + p.y * .10, 0.0, 1.0));
    bg = mix(bg, c2, sweep * .48);
    bg = mix(bg, bg * (.82 + b.satelliteColorMix.xyz * .34), b.satelliteColorMix.w);
    float vignette = 1.0 - .16 * smoothstep(.38, .92, length((p - .5) * float2(.92,1.08)));
    return float4(linearToSrgb(bg * vignette), 1.0);
}
