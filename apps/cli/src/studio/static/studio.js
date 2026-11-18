// Studio enhancements. Every page works without this file; it adds live progress, the script length meter,
// series-dependent fields and a guard against double submits.

// live progress: poll while a job runs, swap the status panel, reload when the run changes phase
for (const el of document.querySelectorAll("[data-live]")) {
  const url = el.getAttribute("data-live");
  const started = el.getAttribute("data-phase");
  const tick = async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        const s = await r.json();
        if (s.phase !== started && s.phase !== "running" && s.phase !== "queued") {
          location.reload();
          return;
        }
        const panel = el.querySelector("[data-live-panel]");
        if (panel && !panel.contains(document.activeElement)) panel.innerHTML = s.panel;
      }
    } catch {
      // the studio restarting; try again on the next tick
    }
    setTimeout(tick, 2000);
  };
  setTimeout(tick, 2000);
}

// new episode: show the fields that belong to the chosen series only
const seriesRadios = document.querySelectorAll('input[name="series"]');
const syncSeries = () => {
  const picked = document.querySelector('input[name="series"]:checked')?.value;
  for (const el of document.querySelectorAll("[data-for-series]")) {
    el.hidden = el.dataset.forSeries !== picked;
    // a hidden group must not send its answers along
    for (const input of el.querySelectorAll("input, textarea")) input.disabled = el.hidden;
  }
};
for (const r of seriesRadios) r.addEventListener("change", syncSeries);
if (seriesRadios.length) syncSeries();

// script editor: how long the spoken text is against the format's budget
for (const form of document.querySelectorAll("form[data-budget]")) {
  const budget = Number(form.dataset.budget);
  const meter = form.querySelector("[data-meter]");
  const text = form.querySelector("[data-meter-text]");
  const bar = form.querySelector(".meter-bar span");
  const update = () => {
    let chars = 0;
    for (const t of form.querySelectorAll("textarea[data-spoken]")) chars += t.value.replace(/\*/g, "").trim().length;
    // the server's estimate (model.ts SPEECH), handed over as data attributes so the two never drift
    const seconds = Math.round(chars / Number(form.dataset.cps) + Number(form.dataset.pad));
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    const over = chars > budget;
    text.textContent = over
      ? `Lời đọc ${chars} / ${budget} ký tự: vượt ${chars - budget}, hãy cắt bớt vài câu`
      : `Lời đọc ${chars} / ${budget} ký tự, video khoảng ${time}`;
    meter.dataset.over = String(over);
    bar.parentElement.style.setProperty("--fill", String(Math.min(1, chars / budget)));
  };
  form.addEventListener("input", update);
  update();
}

// caption preview: the line as the video will show it, *marked* words in yellow
const escapeHtml = (t) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
for (const t of document.querySelectorAll("textarea[data-preview]")) {
  const out = document.getElementById(t.dataset.preview);
  t.addEventListener("input", () => {
    out.innerHTML = escapeHtml(t.value).replace(/\*([^*]+)\*/g, '<mark class="hl">$1</mark>');
  });
}

// grow text areas with their text
for (const t of document.querySelectorAll("textarea")) {
  const fit = () => {
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight + 2}px`;
  };
  t.addEventListener("input", fit);
  fit();
}

// one submit per form: the pressed button shows it is working, at full strength (loading is not disabled)
for (const form of document.querySelectorAll("form[data-submit-busy]")) {
  form.addEventListener("submit", (e) => {
    if (form.dataset.sent) {
      e.preventDefault();
      return;
    }
    form.dataset.sent = "1";
    const button = e.submitter ?? form.querySelector("button[type=submit]");
    if (button) {
      button.setAttribute("aria-busy", "true");
      const label = button.querySelector("span");
      if (label) label.textContent = "Đang gửi";
    }
  });
}
