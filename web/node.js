const WaveFile = require("wavefile").WaveFile;
const fs = require("fs");

// Read a wav file from a data URI
let wav = new WaveFile(fs.readFileSync("./recording.wav"));

// Check some of the file properties
console.log(wav.container);
console.log(wav.chunkSize);
console.log(wav.fmt);

// Change the bit depth to 24-bit
// wav.toBitDepth("24");

// Write the new 24-bit file
// fs.writeFileSync("24bit-file.wav", wav.toBuffer());
