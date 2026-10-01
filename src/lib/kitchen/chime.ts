/**
 * Carillon de nouvelle commande (Web Audio, aucun fichier son). Le navigateur
 * n'autorise le son qu'après un geste de l'utilisateur : `unlockChime()` est
 * appelé depuis le bouton « Activer le son ».
 */
let context: AudioContext | null = null;

export async function unlockChime(): Promise<boolean> {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch {
    return false;
  }
}

export function playChime() {
  if (!context || context.state !== 'running') return;
  const start = context.currentTime;
  // Deux notes montantes (mi, si), courtes et douces : audibles sans être agressives.
  [659.25, 987.77].forEach((frequency, i) => {
    const osc = context!.createOscillator();
    const gain = context!.createGain();
    const t = start + i * 0.18;
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain).connect(context!.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}
