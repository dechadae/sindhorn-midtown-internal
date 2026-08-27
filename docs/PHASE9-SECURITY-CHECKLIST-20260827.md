# Phase 9 rollout security checklist

- [x] Sindhorn employee tables are isolated from unrelated shared-project user tables.
- [x] RLS is enabled on employee-facing security tables.
- [x] Anonymous users cannot read the employee directory.
- [x] Privileged activation/admin RPCs are service-role only.
- [x] Auth Worker secrets remain outside GitHub/browser code.
- [x] Activation codes are single-use and attempt-limited.
- [x] Visible rollout login is Employee ID + one-time code only.
- [x] Microsoft 365 remains dormant until IHG/Entra tenant administration is available.
- [x] Phase 8.2 atmosphere files are outside this branch's merge scope.
- [ ] Initial super-admin activation physically accepted.
- [ ] Admin MFA/step-up physically accepted.
- [ ] Second employee activation/reuse rejection physically accepted.
- [ ] App-wide auth gate enabled after acceptance.
