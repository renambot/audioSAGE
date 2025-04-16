document.addEventListener("DOMContentLoaded", function () {
  console.log("Page fully loaded!");
  initApp();
});

let audioCtx, canvasCtx, canvas;

async function listMicrophones() {
  const result = [];
  const mics = await navigator.mediaDevices
    .enumerateDevices()
    .then(function (devices) {
      devices.forEach(function (device) {
        if (device.kind === "audioinput") {
          result.push(device);
        }
      });
    })
    .then(function () {
      return result;
    })
    .catch(function (err) {
      console.log("Error listing microphones: ", err);
    });
  return mics;
}

// Function to set up the microphone
async function setupMicrophone(micId) {
  const constraints = {
    audio: {
      deviceId: micId ? { exact: micId } : undefined,
      channelCount: 1,
      sampleRate: 48000,
    },
    video: false,
  };

  let onError = function (err) {
    console.log("The following error occured: " + err);
  };

  navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
}

async function onSuccess(stream) {
  const mediaRecorder = new MediaRecorder(stream);

  visualize(stream);

  // Get the DOM elements for the buttons and sound clips
  const record = document.querySelector(".record");
  const stop = document.querySelector(".stop");
  const soundClips = document.querySelector(".sound-clips");

  // Disable stop button while not recording
  stop.disabled = true;

  let chunks = [];
  let audioData = [];
  let clipCounter = 1;

  const audioContext = new AudioContext();
  const streamSource = audioContext.createMediaStreamSource(stream);
  let processorNode = null;

  record.onclick = function () {
    mediaRecorder.start();
    console.log(mediaRecorder.state);
    console.log("Recorder started.");
    record.style.background = "red";

    streamSource.connect(processorNode);
    processorNode.connect(audioContext.destination);

    stop.disabled = false;
    record.disabled = true;
  };

  stop.onclick = function () {
    mediaRecorder.stop();
    console.log("State:", mediaRecorder.state);
    console.log("Recorder stopped.");
    record.style.background = "";
    record.style.color = "";

    streamSource.disconnect(processorNode);
    processorNode.disconnect();

    stop.disabled = true;
    record.disabled = false;
  };

  // Load the worklet processor
  await audioContext.audioWorklet.addModule("audio-processor.js");
  processorNode = new AudioWorkletNode(audioContext, "audio-processor");
  processorNode.port.onmessage = (event) => {
    // console.log("Received data from processor: ", event.data.length);
    audioData.push(new Float32Array(event.data));
  };

  mediaRecorder.onstop = function (e) {
    console.log("Last data to read (after MediaRecorder.stop() called).");

    if (processorNode) {
      processorNode.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      processorNode = null;
      console.log("Processor disconnected.");
    }

    console.log("Audio data length: ", audioData);
    const dataLength = audioData.length * audioData[0].length;
    const data = new Float32Array(dataLength);
    for (let i = 0; i < audioData.length; i++) {
      data.set(audioData[i], i * audioData[0].length);
    }
    var wav = new wavefile.WaveFile();
    wav.fromScratch(1, 48000, "32", data);
    console.log("WAV data: ", wav);
    const wblob = new Blob([wav.toBuffer()], { type: "audio/wav" });

    const wavBlob = encodeWAV(data, 1, 48000, 1, 16);

    const audioUrl = URL.createObjectURL(wavBlob);
    // const audioUrl = URL.createObjectURL(wblob);

    document.getElementById("downloadAudio").onclick = () => {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = "recording.wav";
      a.click();
    };
    document.getElementById("downloadAudio").disabled = false;

    const clipName = "Clip " + clipCounter;
    clipCounter++;

    const clipContainer = document.createElement("article");
    const clipLabel = document.createElement("p");
    const audio = document.createElement("audio");
    const deleteButton = document.createElement("button");

    clipContainer.classList.add("clip");
    audio.setAttribute("controls", "");
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete";

    clipLabel.textContent = clipName;

    clipContainer.appendChild(audio);
    clipContainer.appendChild(clipLabel);
    clipContainer.appendChild(deleteButton);
    soundClips.appendChild(clipContainer);

    audio.controls = true;
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
    chunks = [];
    const audioURL = window.URL.createObjectURL(blob);
    audio.src = audioURL;
    console.log("recorder stopped");

    deleteButton.onclick = function (e) {
      e.target.closest(".clip").remove();
    };
  };

  mediaRecorder.ondataavailable = function (e) {
    console.log("data available", e);
    chunks.push(e.data);
  };
}

// Function to initialize the app
async function initApp() {
  console.log("App initialization");
  // Set up basic variables for app
  canvas = document.querySelector(".visualizer");
  const selectElement = document.getElementById("microphoneSelect");
  selectElement.innerHTML = "";

  // Visualiser setup - create web audio api context and canvas
  canvasCtx = canvas.getContext("2d");

  // Main block for doing the audio recording
  if (navigator.mediaDevices.getUserMedia) {
    console.log("The mediaDevices.getUserMedia() method is supported.");

    selectElement.addEventListener("change", (event) => {
      let val = event.target.value;
      console.log("Selected microphone: ", val);
      setupMicrophone(val);
    });

    const mics = await listMicrophones();
    console.log("Microphones: ", mics.length);
    let selected = null;
    // Populate the select dropdown
    mics.forEach((mic, index) => {
      const option = document.createElement("option");
      option.value = mic.deviceId;
      option.textContent = mic.label || `Microphone ${index + 1}`;
      selectElement.appendChild(option);
      if (option.textContent.toLocaleLowerCase().includes("default")) {
        selected = option.value;
      }
    });

    if (mics.length === 0) {
      const option = document.createElement("option");
      option.textContent = "No microphones found";
      selectElement.appendChild(option);
    } else {
      selectElement.value = selected;
      setupMicrophone(selected);
    }
  } else {
    console.log("MediaDevices.getUserMedia() not supported on your browser!");
  }
}

function visualize(stream) {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }

  const source = audioCtx.createMediaStreamSource(stream);

  const bufferLength = 1024;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = bufferLength;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);

  draw();

  function draw() {
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    requestIdleCallback(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = "rgb(200, 200, 200)";
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(0, 0, 0)";
    canvasCtx.beginPath();

    let sliceWidth = (WIDTH * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = (v * HEIGHT) / 2;
      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }
}

// WAVE functions

function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
  var bytesPerSample = bitDepth / 8;
  var blockAlign = numChannels * bytesPerSample;

  var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  var view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* format chunk identifier */
  writeString(view, 12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, "data");
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);
  if (format === 1) {
    // Raw PCM
    floatTo16BitPCM(view, 44, samples);
  } else {
    writeFloat32(view, 44, samples);
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeFloat32(output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true);
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
