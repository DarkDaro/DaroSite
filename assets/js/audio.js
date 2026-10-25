/* Музыка, звуковые эффекты и озвучка. Классический скрипт, без модулей и без fetch. */

(function () {
  "use strict";

  var doc = document;
  var STORAGE_KEY = "sol-sound";
  var VOLUME_KEY = "sol-volume";
  var TRACK_KEY = "sol-sound-track";
  var TIME_KEY = "sol-sound-time";
  var MUSIC_BASE = 0.18;
  var EFFECT_BASE = 0.09;
  var VOICE_BASE = 0.6;
  var DEFAULT_VOLUME = 0.7;
  var tracks = {
    rain: "assets/audio/rain.mp3",
    paper: "assets/audio/paper.mp3",
    industry: "assets/audio/industry.mp3",
    neon: "assets/audio/neon.mp3",
    signal: "assets/audio/signal.mp3"
  };

  var audio = null;
  var button = null;
  var enabled = true;
  var currentTrack = "rain";
  var fadeFrame = 0;
  var saveAt = 0;
  var gestureArmed = false;
  var fxContext = null;
  var fxGain = null;
  var fxCompressor = null;
  var speaking = false;
  var voice = null;
  var masterVolume = DEFAULT_VOLUME;

  function pageName() {
    if (doc.body && doc.body.dataset.page) return doc.body.dataset.page;
    return "home";
  }

  function trackForPage(page) {
    if (page === "home") return "rain";
    if (page === "library" || page === "book" || page === "chapter") return "paper";
    if (page === "gallery") return "neon";
    if (page === "about") return "signal";
    return "industry";
  }

  function readEnabled() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "0") return false;
      if (stored === "1") return true;
    } catch (error) { /* локальное хранилище может быть недоступно */ }
    return true;
  }

  function writeEnabled(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch (error) { /* без хранилища */ }
  }

  function readVolume() {
    try {
      var stored = parseFloat(window.localStorage.getItem(VOLUME_KEY));
      if (isFinite(stored) && stored >= 0 && stored <= 1) return stored;
    } catch (error) { /* без хранилища */ }
    return DEFAULT_VOLUME;
  }

  function writeVolume(value) {
    try { window.localStorage.setItem(VOLUME_KEY, String(value)); } catch (error) { /* без хранилища */ }
  }

  function musicLevel() { return MUSIC_BASE * masterVolume; }
  function effectLevel() { return EFFECT_BASE * masterVolume; }
  function voiceLevel() { return VOICE_BASE * masterVolume; }

  function syncVolumeControls() {
    var percent = Math.round(masterVolume * 100);
    doc.querySelectorAll("[data-volume]").forEach(function (input) {
      input.style.setProperty("--volume", percent + "%");
      if (input.value !== String(percent)) input.value = String(percent);
    });
    doc.querySelectorAll("[data-volume-value]").forEach(function (output) {
      var text = percent + "%";
      if (output.textContent !== text) output.textContent = text;
    });
  }

  function applyVolumes() {
    if (audio) audio.volume = enabled ? musicLevel() : 0;
    if (fxGain && fxContext) {
      fxGain.gain.setTargetAtTime(effectLevel(), fxContext.currentTime, 0.015);
    }
  }

  function setVolume(value) {
    value = Number(value);
    if (!isFinite(value)) return;
    masterVolume = Math.max(0, Math.min(1, value));
    writeVolume(masterVolume);
    if (fadeFrame) {
      window.cancelAnimationFrame(fadeFrame);
      fadeFrame = 0;
    }
    applyVolumes();
    if (enabled && masterVolume > 0 && audio && audio.paused) play();
    syncVolumeControls();
  }

  function readSession(key) {
    try { return window.sessionStorage.getItem(key); } catch (error) { return null; }
  }

  function writeSession(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (error) { /* без хранилища */ }
  }

  function updateButton() {
    if (!button) return;
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.setAttribute("aria-label", enabled ? "Выключить звук" : "Включить звук");
    button.title = enabled ? "Выключить музыку, эффекты и озвучку" : "Включить музыку, эффекты и озвучку";
    if (enabled) button.classList.remove("is-muted");
    else button.classList.add("is-muted");
  }

  function fadeTo(target, duration) {
    if (!audio) return;
    if (fadeFrame) window.cancelAnimationFrame(fadeFrame);
    var start = audio.volume;
    var started = window.performance.now();
    function step(now) {
      var progress = Math.min(1, (now - started) / duration);
      var value = start + (target - start) * progress;
      audio.volume = Math.max(0, Math.min(1, value));
      if (progress < 1) fadeFrame = window.requestAnimationFrame(step);
      else fadeFrame = 0;
    }
    fadeFrame = window.requestAnimationFrame(step);
  }

  function saveState() {
    if (!audio) return;
    writeSession(TRACK_KEY, currentTrack);
    writeSession(TIME_KEY, String(audio.currentTime || 0));
  }

  function armGesture() {
    if (gestureArmed) return;
    gestureArmed = true;
    function wake() {
      doc.removeEventListener("pointerdown", wake, true);
      doc.removeEventListener("keydown", wake, true);
      doc.removeEventListener("touchstart", wake, true);
      gestureArmed = false;
      if (enabled) play();
    }
    doc.addEventListener("pointerdown", wake, true);
    doc.addEventListener("keydown", wake, true);
    doc.addEventListener("touchstart", wake, true);
  }

  function play() {
    if (!audio || !enabled || masterVolume <= 0) return;
    var level = musicLevel();
    audio.volume = level * 0.75;
    var promise = audio.play();
    if (promise && promise.catch) {
      promise.catch(function () {
        if (button) {
          button.classList.add("is-blocked");
          button.title = "Нажмите, чтобы включить звук";
        }
        armGesture();
      });
    }
    fadeTo(level, 1100);
    if (button) button.classList.remove("is-blocked");
  }

  function setEnabled(value) {
    enabled = !!value;
    writeEnabled(enabled);
    updateButton();
    if (enabled) {
      play();
    } else {
      stopSpeech(false);
      fadeTo(0, 320);
      window.setTimeout(function () {
        if (!enabled && audio) {
          audio.volume = 0;
          audio.pause();
        }
      }, 340);
    }
  }

  function onTimeUpdate() {
    if (!audio) return;
    var now = Date.now();
    if (now - saveAt < 2500) return;
    saveAt = now;
    saveState();
  }

  function onVisibility() {
    if (!audio) return;
    if (doc.hidden) {
      saveState();
      audio.pause();
      stopSpeech(false);
    } else if (enabled) {
      play();
    }
  }

  function restorePosition() {
    var savedTrack = readSession(TRACK_KEY);
    var savedTime = parseFloat(readSession(TIME_KEY) || "0");
    if (savedTrack !== currentTrack || !isFinite(savedTime) || savedTime <= 0) return;
    function apply() {
      try {
        if (isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = savedTime % audio.duration;
        }
      } catch (error) { /* метаданные ещё не готовы */ }
    }
    if (audio.readyState >= 1) apply();
    else audio.addEventListener("loadedmetadata", apply, { once: true });
  }

  function ensureFx() {
    if (!enabled) return null;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!fxContext) {
      fxContext = new Ctx();
      fxGain = fxContext.createGain();
      fxGain.gain.value = effectLevel();
      fxCompressor = fxContext.createDynamicsCompressor();
      fxCompressor.threshold.value = -12;
      fxCompressor.knee.value = 6;
      fxCompressor.ratio.value = 6;
      fxCompressor.attack.value = 0.003;
      fxCompressor.release.value = 0.25;
      fxGain.connect(fxCompressor);
      fxCompressor.connect(fxContext.destination);
    }
    if (fxContext.state === "suspended") fxContext.resume();
    return fxContext;
  }

  function tone(freq, duration, options) {
    var ctx = ensureFx();
    if (!ctx) return;
    options = options || {};
    var start = ctx.currentTime + (options.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(freq, start);
    if (options.end) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.end), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.gain || 0.1), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(fxGain);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function noise(duration, gainValue) {
    var ctx = ensureFx();
    if (!ctx) return;
    var length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1150;
    filter.Q.value = 0.7;
    var gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(fxGain);
    src.start();
  }

  function effect(name) {
    if (!enabled || masterVolume <= 0) return;
    if (name === "click") {
      tone(880, 0.055, { type: "triangle", gain: 0.075, end: 620 });
    } else if (name === "open") {
      tone(520, 0.12, { type: "sine", gain: 0.07, end: 760 });
      tone(760, 0.09, { type: "sine", gain: 0.045, delay: 0.055 });
    } else if (name === "close") {
      tone(640, 0.12, { type: "sine", gain: 0.065, end: 400 });
    } else if (name === "toggle") {
      tone(440, 0.06, { type: "square", gain: 0.045 });
      tone(660, 0.06, { type: "square", gain: 0.035, delay: 0.065 });
    } else if (name === "page") {
      noise(0.075, 0.035);
      tone(220, 0.12, { type: "sine", gain: 0.035, end: 170 });
    } else if (name === "search") {
      noise(0.045, 0.022);
      tone(1180, 0.04, { type: "sine", gain: 0.03 });
    } else if (name === "found") {
      tone(880, 0.09, { type: "sine", gain: 0.05 });
      tone(1320, 0.12, { type: "sine", gain: 0.04, delay: 0.07 });
    } else if (name === "error") {
      tone(170, 0.2, { type: "sawtooth", gain: 0.04, end: 120 });
    } else if (name === "voice") {
      tone(660, 0.07, { type: "sine", gain: 0.045 });
      tone(990, 0.08, { type: "sine", gain: 0.03, delay: 0.07 });
    }
  }

  function hasSpeech() {
    return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  function pickVoice() {
    if (!hasSpeech()) return null;
    var voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    var russian = voices.filter(function (item) { return /^ru/i.test(item.lang); });
    if (!russian.length) return null;
    var local = russian.filter(function (item) { return item.localService; });
    return local[0] || russian[0];
  }

  function cleanSpeech(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .replace(/\*\*\*/g, ". ")
      .replace(/^-\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function markVoiceButtons(active) {
    doc.querySelectorAll("[data-voice-chapter], [data-voice-kind]").forEach(function (item) {
      item.setAttribute("aria-pressed", active ? "true" : "false");
      if (active) {
        if (!item.dataset.defaultLabel) item.dataset.defaultLabel = item.textContent;
        item.textContent = "Остановить";
        item.classList.add("is-speaking");
      } else {
        if (item.dataset.defaultLabel) item.textContent = item.dataset.defaultLabel;
        item.classList.remove("is-speaking");
      }
    });
  }

  function stopSpeech(withSound) {
    if (hasSpeech()) window.speechSynthesis.cancel();
    speaking = false;
    markVoiceButtons(false);
    if (withSound) effect("close");
  }

  function speak(text, sourceButton) {
    if (!hasSpeech()) {
      effect("error");
      return;
    }
    if (!enabled) setEnabled(true);
    var clean = cleanSpeech(text);
    if (!clean) return;
    stopSpeech(false);
    if (!voice) voice = pickVoice();
    var utterance = new window.SpeechSynthesisUtterance(clean);
    utterance.lang = "ru-RU";
    utterance.rate = 0.92;
    utterance.pitch = 0.92;
    utterance.volume = voiceLevel();
    if (voice) utterance.voice = voice;
    utterance.onstart = function () {
      speaking = true;
      markVoiceButtons(true);
      if (sourceButton) sourceButton.classList.add("is-speaking");
    };
    utterance.onend = function () {
      speaking = false;
      markVoiceButtons(false);
    };
    utterance.onerror = function () {
      speaking = false;
      markVoiceButtons(false);
    };
    window.speechSynthesis.speak(utterance);
    effect("voice");
  }

  function chapterSpeech(n) {
    var site = window.SITE;
    if (!site || !site.chapters) return "";
    var chapter = site.chapters.find(function (item) { return item.n === Number(n); });
    if (!chapter || !chapter.text) return "";
    return "Глава " + chapter.n + ". " + chapter.title + ". " + chapter.text;
  }

  function itemSpeech(kind, id) {
    var site = window.SITE;
    if (!site) return "";
    var collection = null;
    if (kind === "character") collection = site.characters;
    else if (kind === "location") collection = site.locations;
    else if (kind === "corporation") collection = site.corporations;
    else if (kind === "implant") collection = site.implants;
    else if (kind === "weapon") collection = site.weapons;
    if (!collection) return "";
    var item = collection.find(function (entry) { return entry.id === id; });
    if (!item) return "";
    var parts = [item.name];
    if (item.role) parts.push(item.role);
    if (item.tier) parts.push(item.tier);
    if (item.sector) parts.push(item.sector);
    if (item.cls) parts.push(item.cls);
    if (item.summary) parts.push(item.summary);
    if (Array.isArray(item.bio)) parts.push(item.bio.join(" "));
    else if (item.bio) parts.push(item.bio);
    if (item.hazards) parts.push(item.hazards);
    if (item.quote) parts.push("Цитата. " + item.quote);
    return parts.join(". ");
  }

  function onDocumentClick(event) {
    var target = event.target.closest ? event.target.closest("button, a") : null;

    var voiceChapter = event.target.closest ? event.target.closest("[data-voice-chapter]") : null;
    if (voiceChapter) {
      if (speaking) stopSpeech(true);
      else speak(chapterSpeech(voiceChapter.getAttribute("data-voice-chapter")), voiceChapter);
      return;
    }

    var voiceDossier = event.target.closest ? event.target.closest("[data-voice-kind]") : null;
    if (voiceDossier) {
      if (speaking) stopSpeech(true);
      else speak(itemSpeech(voiceDossier.getAttribute("data-voice-kind"), voiceDossier.getAttribute("data-voice-id")), voiceDossier);
      return;
    }

    var test = event.target.closest ? event.target.closest("[data-sound-test]") : null;
    if (test) {
      var testKind = test.getAttribute("data-sound-test");
      if (testKind === "music") {
        if (!enabled) setEnabled(true);
        if (audio) {
          audio.volume = 0;
          try { audio.currentTime = 0; } catch (error) { /* метаданные ещё не готовы */ }
        }
        play();
        effect("toggle");
      } else if (testKind === "effect") {
        effect("found");
      } else if (testKind === "voice") {
        speak("Соляной протокол. Город Кассий. Дождь по расписанию.");
      }
      return;
    }

    if (!target) return;
    if (target.matches("[data-sound-toggle]")) return;
    if (target.matches("[data-open-menu], [data-open-search]")) {
      effect("open");
      return;
    }
    if (target.matches("[data-close-menu], [data-close-search]")) {
      effect("close");
      return;
    }
    if (target.matches("button")) {
      effect("click");
      return;
    }
    if (target.matches("a")) {
      var href = target.getAttribute("href") || "";
      if (href && href.charAt(0) !== "#") effect("page");
      else effect("click");
    }
  }

  function init() {
    button = doc.querySelector("[data-sound-toggle]");
    currentTrack = trackForPage(pageName());
    enabled = readEnabled();
    masterVolume = readVolume();
    updateButton();

    audio = doc.createElement("audio");
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0;
    audio.setAttribute("aria-hidden", "true");
    audio.src = tracks[currentTrack] || tracks.rain;
    doc.body.appendChild(audio);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("error", function () {
      if (button) {
        button.disabled = true;
        button.title = "Аудио недоступно";
      }
    });
    doc.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", saveState);
    window.addEventListener("beforeunload", saveState);
    doc.addEventListener("click", onDocumentClick);
    doc.addEventListener("input", function (event) {
      var input = event.target.closest ? event.target.closest("[data-volume]") : null;
      if (!input) return;
      setVolume(Number(input.value) / 100);
    });
    doc.addEventListener("change", function (event) {
      var input = event.target.closest ? event.target.closest("[data-volume]") : null;
      if (input) effect("click");
    });

    var main = doc.getElementById("main");
    if (main && window.MutationObserver) {
      new MutationObserver(function () { syncVolumeControls(); }).observe(main, { childList: true, subtree: true });
    }

    if (hasSpeech()) {
      voice = pickVoice();
      window.speechSynthesis.onvoiceschanged = function () { voice = pickVoice(); };
    }

    if (button) {
      button.addEventListener("click", function () {
        if (enabled) effect("toggle");
        setEnabled(!enabled);
        if (enabled) effect("toggle");
      });
    }

    restorePosition();
    syncVolumeControls();
    if (enabled) play();
    else audio.pause();
  }

  window.SolSound = {
    toggle: function () { setEnabled(!enabled); },
    setEnabled: setEnabled,
    effect: effect,
    speak: speak,
    stopVoice: function () { stopSpeech(true); },
    isSpeaking: function () { return speaking; },
    getVolume: function () { return masterVolume; },
    setVolume: setVolume,
    syncVolume: syncVolumeControls,
    getState: function () {
      return {
        enabled: enabled,
        track: currentTrack,
        src: audio ? audio.src : "",
        paused: audio ? audio.paused : true,
        volume: audio ? audio.volume : 0,
        masterVolume: masterVolume,
        musicVolume: musicLevel(),
        effectVolume: effectLevel(),
        voiceVolume: voiceLevel(),
        speaking: speaking,
        voice: voice ? voice.name : ""
      };
    }
  };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})();
