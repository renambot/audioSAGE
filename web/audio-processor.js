const sampleRate = 48000;
// const sampleRate = 16000;

/**
 * A simple bypass node demo.
 *
 * @class myProcessor
 * @extends AudioWorkletProcessor
 */
class myProcessor extends AudioWorkletProcessor {
  // When constructor() undefined, the default constructor will be implicitly
  // used.

  process(inputs, outputs) {
    // By default, the node has single input and output.
    const input = inputs[0]; // First audio input

    if (input && input.length > 0) {
      // Downsample to 16kHz from 48kHz
      // const down = resampleTo16kHZ(input[0], sampleRate); // First channel (Mono)
      // this.port.postMessage(down);

      // Full audio data
      this.port.postMessage(input[0]);
    }

    return true;
  }
}

function resampleTo16kHZ(audioData, origSampleRate) {
  // Convert the audio data to a Float32Array
  const data = new Float32Array(audioData);

  // Calculate the desired length of the resampled data
  const targetLength = Math.round(data.length * (16000 / origSampleRate));
  // Create a new Float32Array for the resampled data
  const resampledData = new Float32Array(targetLength);

  // Calculate the spring factor and initialize the first and last values
  const springFactor = (data.length - 1) / (targetLength - 1);
  resampledData[0] = data[0];
  resampledData[targetLength - 1] = data[data.length - 1];

  // Resample the audio data
  for (let i = 1; i < targetLength - 1; i++) {
    const index = i * springFactor;
    const leftIndex = Math.floor(index).toFixed();
    const rightIndex = Math.ceil(index).toFixed();
    const fraction = index - leftIndex;
    resampledData[i] =
      data[leftIndex] + (data[rightIndex] - data[leftIndex]) * fraction;
  }

  // Return the resampled data
  return resampledData;
}

registerProcessor("audio-processor", myProcessor);
