// ============ Nav scroll state + mobile toggle ============
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

const onScroll = () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ============ Reveal on scroll ============
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('in'), i % 6 * 70);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('in'));
}

// ============ Hero floating music notes ============
const particleHost = document.getElementById('heroParticles');
const glyphs = ['♪', '♫', '♬', '✦'];
if (particleHost && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const count = window.innerWidth < 640 ? 8 : 16;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = 'note';
    span.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    const left = Math.random() * 100;
    const duration = 10 + Math.random() * 10;
    const delay = Math.random() * 14;
    const size = 14 + Math.random() * 18;
    const drift = (Math.random() * 80 - 40) + 'px';
    span.style.left = left + '%';
    span.style.fontSize = size + 'px';
    span.style.animationDuration = duration + 's';
    span.style.animationDelay = delay + 's';
    span.style.setProperty('--drift', drift);
    particleHost.appendChild(span);
  }
}

// ============ Mobile autoplay fallback ============
// Mobile browsers (especially iOS Safari, or with low-power/data-saver modes
// on) sometimes ignore the `autoplay` attribute even when muted+playsinline
// are set correctly. Retry explicitly on load, and again on the very first
// touch/scroll/click — a real user gesture always unlocks playback.
const heroVideo = document.getElementById('heroVideo');
if (heroVideo) {
  const tryPlayVideo = () => heroVideo.play().catch(() => {});
  tryPlayVideo();

  const unlockVideo = () => {
    if (heroVideo.paused) tryPlayVideo();
    ['touchstart', 'click', 'scroll'].forEach(evt =>
      document.removeEventListener(evt, unlockVideo)
    );
  };
  ['touchstart', 'click', 'scroll'].forEach(evt =>
    document.addEventListener(evt, unlockVideo, { once: true, passive: true })
  );
}

// ============ Cursor glow (desktop only) ============
const glow = document.getElementById('cursorGlow');
if (glow && window.matchMedia('(min-width: 900px)').matches) {
  window.addEventListener('mousemove', (e) => {
    glow.style.transform = `translate(${e.clientX - 210}px, ${e.clientY - 210}px)`;
  });
}

// ============ Hero background music playlist ============
// The hero video itself always stays muted (visual-only loop);
// a cover playlist plays as the actual soundtrack, started on user click
// (browsers block unmuted autoplay, so this only ever starts on a real tap).
// Tracks play in order and crossfade into one another, looping back to the
// first track after the last one finishes. The credit pill updates to match
// whichever cover is currently playing.
const bgMusic = document.getElementById('bgMusic');
const soundToggle = document.getElementById('soundToggle');
const iconOff = document.getElementById('soundIconOff');
const iconOn = document.getElementById('soundIconOn');
const soundLabel = document.getElementById('soundLabel');
const creditText = document.getElementById('heroCreditText');

const PLAYLIST = [
  { m4a: 'assets/mysong1.m4a', mp3: 'assets/mysong1.mp3', credit: 'Song by FIFTY FIFTY · Cover by OkieMookie' },
  { m4a: 'assets/mysong2.m4a', mp3: 'assets/mysong2.mp3', credit: 'Song by ILLIT · Cover by OkieMookie' },
  { m4a: 'assets/mysong3.m4a', mp3: 'assets/mysong3.mp3', credit: 'Song by ILLIT · Cover by OkieMookie' },
];
const FADE_MS = 1200;

if (bgMusic && soundToggle) {
  let trackIndex = 0;
  let started = false;
  let fadeTimer = null;
  let fadingOut = false;
  let audioCtx = null;
  let gainNode = null;

  const pickSrc = (track) => (bgMusic.canPlayType('audio/mp4') ? track.m4a : track.mp3);

  const setCredit = (text) => {
    if (!creditText || creditText.textContent === text) return;
    creditText.classList.add('swapping');
    setTimeout(() => {
      creditText.textContent = text;
      creditText.classList.remove('swapping');
    }, 350);
  };

  // iOS Safari makes <audio>.volume read-only (by design — volume there is
  // meant to stay tied to the hardware buttons), so a plain volume fade
  // silently does nothing on iPhones and tracks just cut hard into each
  // other. Routing playback through a Web Audio GainNode instead sidesteps
  // that restriction and fades reliably on every platform. Set up lazily,
  // on the first tap, since AudioContext also needs a user gesture on iOS.
  const ensureAudioGraph = () => {
    if (gainNode) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // ancient browser — falls back to .volume below
    audioCtx = new Ctx();
    const source = audioCtx.createMediaElementSource(bgMusic);
    gainNode = audioCtx.createGain();
    source.connect(gainNode).connect(audioCtx.destination);
  };
  const setVolume = (v) => { if (gainNode) gainNode.gain.value = v; else bgMusic.volume = v; };
  const getVolume = () => (gainNode ? gainNode.gain.value : bgMusic.volume);

  // Timer-based (not rAF) so the fade keeps progressing even if the tab
  // is backgrounded — rAF is fully suspended on hidden pages, which would
  // otherwise leave a fade stuck partway through.
  const fadeVolume = (from, to, duration, onDone) => {
    clearInterval(fadeTimer);
    const start = Date.now();
    setVolume(from);
    fadeTimer = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setVolume(from + (to - from) * t);
      if (t >= 1) {
        clearInterval(fadeTimer);
        if (onDone) onDone();
      }
    }, 50);
  };

  const loadTrack = (index, autoplay) => {
    const track = PLAYLIST[index];
    fadingOut = false;
    bgMusic.src = pickSrc(track);
    bgMusic.load();
    setCredit(track.credit);
    if (autoplay) {
      setVolume(0);
      bgMusic.play().then(() => fadeVolume(0, 1, FADE_MS)).catch(() => {});
    }
  };

  const advanceTrack = () => {
    trackIndex = (trackIndex + 1) % PLAYLIST.length;
    loadTrack(trackIndex, true);
  };

  // Fade the current track out during its last ~1.2s, then hand off to the next.
  bgMusic.addEventListener('timeupdate', () => {
    if (!bgMusic.duration || isNaN(bgMusic.duration) || fadingOut) return;
    const remaining = bgMusic.duration - bgMusic.currentTime;
    if (remaining <= FADE_MS / 1000) {
      fadingOut = true;
      fadeVolume(getVolume(), 0, Math.max(50, remaining * 1000));
    }
  });

  bgMusic.addEventListener('ended', advanceTrack);

  const setSoundUI = (on) => {
    iconOff.style.display = on ? 'none' : 'block';
    iconOn.style.display = on ? 'block' : 'none';
    soundLabel.textContent = on ? 'sound on' : 'tap for sound';
  };

  const startMusic = () => {
    ensureAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (!started) {
      started = true;
      loadTrack(trackIndex, true);
    } else if (bgMusic.paused) {
      bgMusic.play().then(() => fadeVolume(0, 1, 400)).catch(() => {});
    }
    setSoundUI(true);
  };

  soundToggle.addEventListener('click', () => {
    if (bgMusic.paused) {
      startMusic();
    } else {
      bgMusic.pause();
      setSoundUI(false);
    }
  });

  // Browsers block audio-with-sound from playing until the visitor has
  // interacted with the page at least once — there's no way to bypass that.
  // So instead of making people hunt down the sound button, treat their
  // very first tap/scroll/click anywhere on the page as that interaction
  // and start the music right then, as close to "automatic" as allowed.
  const autoStartMusic = () => {
    startMusic();
    ['touchstart', 'click', 'scroll'].forEach(evt =>
      document.removeEventListener(evt, autoStartMusic)
    );
  };
  ['touchstart', 'click', 'scroll'].forEach(evt =>
    document.addEventListener(evt, autoStartMusic, { once: true, passive: true })
  );

  // If the visitor navigates away from the hero, ease the music out
  // rather than letting it play forever in the background unnoticed.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) bgMusic.pause();
  });
}

// ============ Footer year ============
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
