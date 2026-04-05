let videos = [];
let playbackStarted = false;
let videosReady = false;
let loadedCount = 0;
let currentVideoIndex = 0;
let videoOrder = [];
let orderPosition = 0;
let lastSwitch = 0;

let overlayVideo = null;
let overlayStartTime = 0;
let overlayVisible = false;
let overlayX = 0;
let overlayY = 0;
let overlaySize = 0;
let nextOverlayCheck = 0;
let currentTintColor = [255, 255, 255];
let videoSwitchCount = 0;

// Timing configuration

const SWITCH_INTERVAL = 1000;
const OVERLAY_DURATION = 3000;
const OVERLAY_CHECK_INTERVAL = 2000;
const OVERLAY_PROBABILITY = 0.5;

// Overlay border configuration
const OVERLAY_BORDER_COLOR = [255, 0, 0]; // RGB
const OVERLAY_BORDER_WIDTH = 0;

// Video tint configuration
const VIDEO_TINT_ALPHA = 255;
const VIDEO_SWITCHES_PER_TINT = 3; // Change tint color every N video switches 
const TINT_RANDOMIZATION_ENABLED = true; // Set to false to disable random tint changes 

function setup() {
    createCanvas(windowWidth, windowHeight);
    frameRate(60);
    
    // Initialize first random tint
    currentTintColor = getRandomTint();
    videoSwitchCount = 0;

    for (let i = 1; i <= 9; i++) {
        const vid = createVideo([`assets/video/tiny/vid${i}.mp4`]);
        prepareVideo(vid);
        videos.push(vid);
    }

    initVideoOrder();
}

function prepareVideo(vid) {
    vid.hide();
    vid.size(640, 360);
    vid.volume(0);
    vid.attribute('muted', '');
    vid.attribute('playsinline', '');
    vid.elt.muted = true;
    vid.elt.addEventListener('canplaythrough', onVideoLoaded);
}

function onVideoLoaded() {
    loadedCount += 1;
    if (loadedCount === videos.length) {
        videosReady = true;
    }
}

function draw() {
    background(20);

    if (!videosReady) {
        showMessage('Loading videos... please wait');
        return;
    }

    if (!playbackStarted) {
        showMessage('Press SPACE or click to start');
        return;
    }

    if (millis() - lastSwitch > SWITCH_INTERVAL) {
        orderPosition += 1;
        if (orderPosition >= videoOrder.length) {
            initVideoOrder();
            orderPosition = 0;
        }
        switchVideo(videoOrder[orderPosition]);
        lastSwitch = millis();
    }

    if (videos[currentVideoIndex]) {
        tint(currentTintColor[0], currentTintColor[1], currentTintColor[2], VIDEO_TINT_ALPHA);
        image(videos[currentVideoIndex], 0, 0, width, height);
        noTint();
    }

    // Ensure main video stays playing
    if (playbackStarted && videos[currentVideoIndex] && videos[currentVideoIndex].elt.paused) {
        videos[currentVideoIndex].elt.play().catch(() => {});
    }

    handleOverlay();
}

function handleOverlay() {
    const now = millis();

    // Handle currently playing overlay
    if (overlayVisible && overlayVideo) {
        const elapsed = now - overlayStartTime;

        if (elapsed < OVERLAY_DURATION) {
            // Ensure overlay video is playing
            if (overlayVideo.elt.paused) {
                overlayVideo.elt.play().catch(() => {});
            }
            tint(currentTintColor[0], currentTintColor[1], currentTintColor[2], VIDEO_TINT_ALPHA);
            image(overlayVideo, overlayX, overlayY, overlaySize, overlaySize);
            noTint();
            
            // Draw border around overlay
            stroke(OVERLAY_BORDER_COLOR[0], OVERLAY_BORDER_COLOR[1], OVERLAY_BORDER_COLOR[2]);
            strokeWeight(OVERLAY_BORDER_WIDTH);
            noFill();
            rect(overlayX, overlayY, overlaySize, overlaySize);
        } else {
            overlayVideo.pause();
            overlayVisible = false;
            // Start the 2-second cooldown before next overlay can appear
            nextOverlayCheck = now + OVERLAY_CHECK_INTERVAL;
        }
    } else {
        // Only check for new overlay when current one is gone
        if (now >= nextOverlayCheck) {
            nextOverlayCheck = now + OVERLAY_CHECK_INTERVAL;
            
            if (Math.random() < OVERLAY_PROBABILITY) {
                startOverlay();
            }
        }
    }
}

function startOverlay() {
    const randomIndex = Math.floor(Math.random() * videos.length);
    overlayVideo = videos[randomIndex];
    
    // Random size between 20% and 50% of screen
    overlaySize = random(width * 0.2, width * 0.5);
    
    // Random position that keeps overlay on screen
    overlayX = random(0, width - overlaySize);
    overlayY = random(0, height - overlaySize);
    
    overlayStartTime = millis();
    overlayVisible = true;
}

function keyPressed() {
    if (key === ' ' && videosReady) {
        startPlayback();
        return false;
    }
}

function mousePressed() {
    if (videosReady) {
        startPlayback();
    }
}

function startPlayback() {
    if (playbackStarted) {
        return;
    }

    videos.forEach((vid) => {
        vid.loop();
        ensureVideoPlaying(vid);
    });

    initVideoOrder();
    orderPosition = 0;
    switchVideo(videoOrder[orderPosition]);
    playbackStarted = true;
    lastSwitch = millis();
    nextOverlayCheck = millis() + OVERLAY_CHECK_INTERVAL;
}

function ensureVideoPlaying(vid) {
    const promise = vid.elt.play();
    if (promise !== undefined) {
        promise
            .then(() => {})
            .catch((error) => {
                console.warn('Video autoplay blocked, will retry on interaction');
                // Retry on next user interaction
                document.addEventListener('click', () => {
                    vid.elt.play().catch(() => {});
                }, { once: true });
            });
    }
}

function initVideoOrder() {
    videoOrder = videos.map((_, i) => i);
    shuffleArray(videoOrder);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function switchVideo(index) {
    currentVideoIndex = index;
    videoSwitchCount += 1;
    
    // Pause all other videos to reduce CPU load
    for (let i = 0; i < videos.length; i++) {
        if (i !== index) {
            videos[i].pause();
        }
    }
    
    // Change tint after every N switches (if randomization is enabled)
    if (TINT_RANDOMIZATION_ENABLED && videoSwitchCount >= VIDEO_SWITCHES_PER_TINT) {
        currentTintColor = getRandomTint();
        videoSwitchCount = 0;
    }
}

function showMessage(msg) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text(msg, width / 2, height / 2);
}

function getRandomTint() {
    return [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
    ];
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
