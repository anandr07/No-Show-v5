/**
 * Generates minimal WAV sound files for the game.
 * Run: node scripts/generate-sounds.js
 */
const fs = require("fs");
const path = require("path");

const soundsDir = path.join(__dirname, "..", "assets", "sounds");
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

function createWav(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * 2; // 16-bit = 2 bytes per sample
  const chunkSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(chunkSize, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;

  // fmt subchunk
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // subchunk size
  buffer.writeUInt16LE(1, offset); offset += 2;  // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data subchunk
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, samples[i])), offset);
    offset += 2;
  }

  return buffer;
}

// Card flip: short click (0.06 sec) - audible
function cardFlipSamples() {
  const sampleRate = 44100;
  const duration = 0.06;
  const len = Math.floor(sampleRate * duration);
  const samples = [];
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const freq = 900;
    const env = Math.exp(-t * 35);
    samples.push(Math.sin(2 * Math.PI * freq * t) * env * 12000);
  }
  return samples;
}

// Success: pleasant ding (0.2 sec)
function successSamples() {
  const sampleRate = 44100;
  const duration = 0.2;
  const len = Math.floor(sampleRate * duration);
  const samples = [];
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const freq = 880;
    const env = Math.exp(-t * 12);
    samples.push(Math.sin(2 * Math.PI * freq * t) * env * 10000);
  }
  return samples;
}

// Card deal: soft thud (0.1 sec)
function cardDealSamples() {
  const sampleRate = 44100;
  const duration = 0.1;
  const len = Math.floor(sampleRate * duration);
  const samples = [];
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const freq = 350;
    const env = Math.exp(-t * 20);
    samples.push(Math.sin(2 * Math.PI * freq * t) * env * 9000);
  }
  return samples;
}

fs.writeFileSync(path.join(soundsDir, "card-flip.wav"), createWav(cardFlipSamples()));
fs.writeFileSync(path.join(soundsDir, "success.wav"), createWav(successSamples()));
fs.writeFileSync(path.join(soundsDir, "card-deal.wav"), createWav(cardDealSamples()));

console.log("Generated sound files in assets/sounds/");
