// src/ui/screens/newspaper-screen.js — The morning paper overlay.
// Rendered on top of the dispatch at the start of each day until dismissed.

export function renderNewspaper(paper) {
  if (!paper) return '';
  return `
    <div class="np-overlay" id="np-overlay">
      <div class="np-sheet">
        <div class="np-masthead">
          <div class="np-outlet">${paper.outlet}</div>
          <div class="np-tagline">${paper.masthead}</div>
          <div class="np-dateline">EST. 2026 &middot; VOL. I &middot; No. ${paper.turn} &middot; MORNING EDITION &middot; PRICE 25&cent;</div>
        </div>

        <div class="np-lead">
          <div class="np-headline">${paper.lead?.headline ?? ''}</div>
          <div class="np-body">${paper.lead?.body ?? ''}</div>
        </div>

        ${paper.second ? `
        <div class="np-second">
          <div class="np-headline-sm">${paper.second.headline}</div>
          <div class="np-body">${paper.second.body}</div>
        </div>` : ''}

        <div class="np-columns">
          <div class="np-col">
            <div class="np-col-label">THE WHISPER COLUMN</div>
            <div class="np-body">${paper.gossip ?? ''}</div>
          </div>
          <div class="np-col">
            <div class="np-col-label">NUMBERS</div>
            <div class="np-body">${paper.poll ?? ''}</div>
            ${(paper.teasers ?? []).map(t => `<div class="np-teaser">${t}</div>`).join('')}
          </div>
        </div>

        <div class="np-ad">${paper.ad ?? ''}</div>

        <button class="np-dismiss" id="btn-dismiss-newspaper">PUT THE PAPER DOWN &middot; START THE DAY</button>
      </div>
    </div>`;
}

export function bindNewspaper(container, handlers) {
  container.querySelector('#btn-dismiss-newspaper')?.addEventListener('click', () => {
    handlers.dismissNewspaper?.();
  });
}
