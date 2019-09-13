// @ts-nocheck
const cameraEl = document.getElementById('camera');
const canvasEl = document.getElementById('canvas');
const resultsEl = document.getElementById('results');
const poseColours = [];
var phaser;
var osc;
var triangle1;
var triangle2;
var filter;
var noise;
var soundIsStarted = false;
var oldFrequence =440;
var slider1;
var slider2;

document.getElementById('btnFreeze').addEventListener('click', evt => {
  if (cameraEl.paused) {
    cameraEl.play();
  } else {
    cameraEl.pause();
  }
});

console.log('Loading posenet model')

// See docs for info on these parameters
// https://github.com/tensorflow/tfjs-models/tree/master/posenet
let model = null;
posenet.load({
  architecture: 'ResNet50',
  outputStride: 32,
  inputResolution: 257,
  quantBytes: 4
}).then(m => {
  model = m;
  console.log('Model loaded, starting camera');
  startCamera();
})



cameraEl.addEventListener('play', () => {
  // Resize canvas to match camera frame sie
  canvasEl.width = cameraEl.videoWidth;
  canvasEl.height = cameraEl.videoHeight;

  // Start processing!
  window.requestAnimationFrame(process);
});

// Processes the last frame from camera
function process() {
  model.estimateMultiplePoses(canvasEl, {
    flipHorizontal: false,
    maxDetections: 1, /* max # poses */
    scoreThreshold: 0.5,
    nmsRadius: 20
  }).then(processPoses); /* call processPoses with result */
}

function processPoses(poses) {
  ////
  //create a synth and connect it to the master output (your speakers)
  //var synth = new Tone.Synth().toMaster()

  //play a middle 'C' for the duration of a note
  //synth.triggerAttackRelease('C4', '1n');
  ////
  startSound();
  //console.log("- - -- - - start sound - --- -- -- -");
  ////

  // For debug purposes, draw points
  drawPoses(poses);


  // Demo of using position:
  //  Calculates a 'slouch factor' - difference in Y between left/right shoulders
  if (poses.length == 1 && poses[0].score > 0.3) {
    // const leftShoulder = getKeypointPos(poses, 'leftShoulder');
    // const rightShoulder = getKeypointPos(poses, 'rightShoulder');
    // if (leftShoulder != null && rightShoulder != null) {
    //   const slouchFactor = Math.floor(Math.abs(leftShoulder.y - rightShoulder.y));

    //   var c = canvasEl.getContext('2d');
    //   c.fillStyle = 'black';
    //   c.fillText('Slouch factor: ' + slouchFactor, 100, 10);
    // }
    
    const leftWrist = getKeypointPos(poses, 'leftWrist');
    const rightWrist = getKeypointPos(poses, 'rightWrist');
    if (leftWrist != null && rightWrist != null && osc != null && pointsAreInFrame(leftWrist,rightWrist)) {
      const distance = Math.floor(Math.abs(leftWrist.x - rightWrist.x));
      var c = canvasEl.getContext('2d');
      c.fillStyle = 'black';
      c.fillText('Distance between arms: ' + distance, 100, 10);
      frequence = distance;
//       slider1 = document.getElementById("triangle1");
//       slider2 = document.getElementById("triangle2");
//       triangle1.frequency.value = slider1.value;
//       triangle2.frequency.value = slider2.value;
//  //     oldFrequence = frequence;

   //   phaser.frequency.value = leftWrist.y;
     // phaser.baseFrequency.value = rightWrist.y;  
    }

    // if ( pointsAreInFrame(leftWrist,rightWrist) ) {
    //   console.log("IN");
    //   osc.volume.value = 100;
    // } else {
    //   console.log("OUT");
    //   osc.volume.value = -100;
    // }
    console.log( "left " + coord2string(leftWrist) + "  right " + coord2string(rightWrist) + ')' );
  }

  slider1 = document.getElementById("triangle1");
  slider2 = document.getElementById("triangle2");
  slider3 = document.getElementById("noise");
  triangle1.frequency.value = slider1.value;
  triangle2.frequency.value = slider2.value;
  //noise.volume.value = slider3.value;
  filter.frequency.value = slider3.value; 
  
  // Repeat, if not paused
  if (cameraEl.paused) {
    console.log('Paused processing');
    return;
  }
  window.requestAnimationFrame(process);
}

function coord2string( point ) {
  return '(' + Math.floor(point.x) + ',' + Math.floor(point.y) + ')';
}

function pointsAreInFrame(point1,point2) {
  var value =   ( 0 <= point1.x && point1.x <= 640 ) &&
    ( 0 <= point1.y && point1.y <= 480 ) &&
    ( 0 <= point2.x && point2.x <= 640 ) &&
    ( 0 <= point2.y && point2.y <= 480 );
  
  //console.log( "Value = " + value + " left " + coord2string(point1) + "  right " + coord2string(point2) + ')' );
  
  return value;
}

// Helper function to get a named keypoint position
function getKeypointPos(poses, name, poseIndex = 0) {
  // Don't return a value if overall score is low
  if (poses.score < 0.3) return null;
  if (poses.length < poseIndex) return null;

  const kp = poses[poseIndex].keypoints.find(kp => kp.part == name);
  if (kp == null) return null;
  return kp.position;
}

function drawPoses(poses) {
  // Draw frame to canvas
  var c = canvasEl.getContext('2d');
  c.drawImage(cameraEl, 0, 0, cameraEl.videoWidth, cameraEl.videoHeight);

  // Fade out image
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillRect(0, 0, cameraEl.videoWidth, cameraEl.videoHeight);

  // Draw each detected pose
  for (var i = 0; i < poses.length; i++) {
    drawPose(i, poses[i], c);
  }

  // If there's no poses, draw a warning
  if (poses.length == 0) {
    c.textBaseline = 'top';
    c.fillStyle = 'red';
    c.fillText('No poses detected', 10, 10);
  }
}

// Draws debug info for each detected pose
function drawPose(index, pose, c) {
  // Lookup or generate random colour for this pose index
  if (!poseColours[index]) poseColours[index] = getRandomColor();
  const colour = poseColours[index];

  // Draw prediction info
  c.textBaseline = 'top';
  c.fillStyle = colour;
  c.fillText(Math.floor(pose.score * 100) + '%', 10, (index * 20) + 10);

  // Draw each pose part
  pose.keypoints.forEach(kp => {
    // Draw a dot for each keypoint
    c.beginPath();
    c.arc(kp.position.x, kp.position.y, 5, 0, 2 * Math.PI);
    c.fill();

    // Draw the keypoint's score (not very useful)
    //c.fillText(Math.floor(kp.score * 100) + '%', kp.position.x + 7, kp.position.y - 3);

    // Draw name of keypoint
    c.fillText(kp.part, kp.position.x - 3, kp.position.y + 6);
    //console.log("part = " + kp.part);
  });
}

// ------------------------
function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Reports outcome of trying to get the camera ready
function cameraReady(err) {
  if (err) {
    console.log('Camera not ready: ' + err);
    return;
  }
  console.log('Camera ready');
}

// Tries to get the camera ready, and begins streaming video to the cameraEl element.
function startCamera() {
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  if (!navigator.getUserMedia) {
    cameraReady('getUserMedia not supported');
    return;
  }
  navigator.getUserMedia({ video: { width: 640, height: 480 }, audio: false },
    (stream) => {
      try {
        cameraEl.srcObject = stream;
      } catch (error) {
        cameraEl.srcObject = window.URL.createObjectURL(stream);
      }
      cameraReady();
    },
    (error) => {
      cameraReady(error);
    });
}

function startSound() {
  if (!soundIsStarted) {
    /*
    phaser = new Tone.Phaser({
      "frequency" : 20,
      "octaves" : 3,
      "baseFrequency" : 440
    }).toMaster();
    osc = new Tone.FatOscillator(440, "square", 80).connect(phaser).start();
    //osc = new Tone.FatOscillator(440, "square", 80).toMaster().start();
    osc = new Tone.Oscillator(440, "sine").toMaster().start();
    */

    filter = new Tone.Filter(200, "bandpass").toMaster();
    noise = new Tone.Noise("pink").connect(filter).start();
    triangle2 = new Tone.Oscillator(120, "triangle", 80).connect(filter).start();
    triangle1 = new Tone.Oscillator(110, "triangle", 80).connect(filter).start();
    noise.volume.value = -13;
    soundIsStarted = true;
  }

}