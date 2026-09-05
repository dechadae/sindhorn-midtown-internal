/* Jobs, on the UI Library. The footer's third tab since r20: every employee's
   own list of what was asked of them - the task, who sent it and when, the
   deadline and where it stands. r20 lands the route, the tab and the job
   card in the library; r21 brings the list itself (sindhorn_jobs_* RPCs), so
   until then the page says so plainly instead of pretending to be empty. */

const hero = `<header class="app-hero"><p class="app-hero-eyebrow">Jobs</p><h1 class="app-hero-title">Job tracker</h1><p class="app-hero-copy">What was asked, who sent it, the deadline and where it stands.</p></header>`;

export async function mountJobs(host) {
  host.innerHTML = `${hero}<section class="app-section"><div class="app-stack">
    <div class="app-state app-card" data-tone="loading"><p class="app-state-label">Coming soon</p><p class="app-state-title">Your job tracker arrives with the next update.</p><p class="app-state-copy">The app updates itself the next time it opens. Nothing to install.</p></div>
  </div></section>`;
  return () => {};
}
