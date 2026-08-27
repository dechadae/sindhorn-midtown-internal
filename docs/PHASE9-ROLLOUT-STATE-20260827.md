# Phase 9 — First Internal Rollout State

**Date:** 27 August 2026  
**Branch:** `phase9-internal-auth-broadcast`

## Current rollout decision

- Employee ID + single-use 6-digit code is the visible login method.
- Microsoft 365 support remains dormant/future-ready and is not shown to employees.
- HR participation is not required for first login.
- The rollout operator pre-provisions employee IDs and can generate activation codes for private delivery by personal email or SMS.
- Personal delivery addresses are not identity authority and are not required in the long-lived public employee profile.

## Initial administrator

The canonical employee directory contains the initial active `super_admin` profile for Employee ID `10639`.

A one-time bootstrap activation code has been provisioned separately in the private activation store. The plaintext code is not recorded in this document or GitHub.

## Deployment posture

The Phase 9 login/admin surfaces are standalone additions and do not gate the existing PWA shell yet. This allows controlled authentication acceptance before the installed app is made private.

The client currently uses the configured preview Auth Worker as a temporary first-rollout bridge because that Worker already has the canonical Supabase/D1 bindings and the required runtime secrets. The production Auth Worker should receive the same secrets before the bridge is retired.

## Acceptance before app-wide auth gate

1. Initial super-admin completes Employee ID activation successfully.
2. Session persists after reopen.
3. `/admin.html` recognizes the super-admin profile.
4. Employee directory can be read.
5. MFA/step-up path is completed before normal privileged writes are enabled for daily admin use.
6. A second test employee is pre-provisioned, receives a generated one-time code, activates successfully, and cannot reuse the consumed code.
7. Only after those checks should the main PWA shell require authentication.
