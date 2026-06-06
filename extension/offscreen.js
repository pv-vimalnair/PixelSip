chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "play-alert-sound") return;
  const audio = new AudioContext();
  const gain = audio.createGain();
  gain.connect(audio.destination);
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.65);

  [0, 0.2, 0.4].forEach((delay, index) => {
    const oscillator = audio.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = [660, 784, 880][index];
    oscillator.connect(gain);
    oscillator.start(audio.currentTime + delay);
    oscillator.stop(audio.currentTime + delay + 0.14);
  });

  setTimeout(() => audio.close(), 900);
});
