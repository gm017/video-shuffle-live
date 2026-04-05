let videos = [];
let playbackStarted = false;
let videosReady = false;
let loadedCount = 0;
let currentVideoIndex = -1;
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
let SWITCH_INTERVAL = 2000;
let OVERLAY_DURATION = 3000;
let OVERLAY_CHECK_INTERVAL = 2000;
let OVERLAY_PROBABILITY = 0;

// Overlay border configuration
let OVERLAY_BORDER_COLOR = [255, 0, 0];
let OVERLAY_BORDER_WIDTH = 0;

// Video tint configuration
let VIDEO_TINT_ALPHA = 255;
let VIDEO_SWITCHES_PER_TINT = 1;
let TINT_RANDOMIZATION_ENABLED = false;

// Control visibility
let VISIBLE_CONTROLS = {
    switchInterval: true,
    overlayDuration: true,
    overlayCheckInterval: true,
    overlayProbability: true,
    overlayBorderWidth: false,
    borderColorR: false,
    borderColorG: false,
    borderColorB: false,
    tintAlpha: false,
    switchesPerTint: true,
    tintEnabled: true
};

function setup() {
    createCanvas(windowWidth, windowHeight);
    frameRate(60);
    textFont('Verdana');

    if (TINT_RANDOMIZATION_ENABLED) {
        currentTintColor = getRandomTint();
    } else {
        currentTintColor = [255, 255, 255];
    }

    videoSwitchCount = 0;

    for (let i = 1; i <= 17; i++) {
        const vid = createVideo([`assets/video/tiny/vid${i}.mp4`]);
        prepareVideo(vid);
        videos.push(vid);
    }

    initVideoOrder();
}

function prepareVideo(vid) {
    vid.hide();
    vid.size(min(width, 640), min(height, 360));
    vid.volume(0);
    vid.attribute('muted', '');
    vid.attribute('playsinline', '');
    vid.attribute('preload', 'auto');
    vid.elt.muted = true;
    vid.elt.preload = 'auto';
    vid.elt.addEventListener('canplaythrough', onVideoLoaded);
}

function onVideoLoaded() {
    loadedCount += 1;
    if (loadedCount === videos.length) {
        videosReady = true;
    }
}

function draw() {
    background(255);

    if (!videosReady) {
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(min(24, width / 20));
        text('Loading videos...\nPlease wait', width / 2, height / 2);
        return;
    }

    if (!playbackStarted) {
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(min(24, width / 20));
        text('click', width / 2, height / 2);
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

    if (currentVideoIndex !== -1 && videos[currentVideoIndex]) {
        tint(currentTintColor[0], currentTintColor[1], currentTintColor[2], VIDEO_TINT_ALPHA);
        image(videos[currentVideoIndex], 0, 0, width, height);
        noTint();
    }

    // Keep current main video alive
    if (
        playbackStarted &&
        currentVideoIndex !== -1 &&
        videos[currentVideoIndex] &&
        videos[currentVideoIndex].elt.paused
    ) {
        videos[currentVideoIndex].elt.play().catch(() => {});
    }

    handleOverlay();
}

function handleOverlay() {
    const now = millis();

    if (overlayVisible && overlayVideo) {
        const elapsed = now - overlayStartTime;

        if (elapsed < OVERLAY_DURATION) {
            if (overlayVideo.elt.paused) {
                overlayVideo.elt.play().catch(() => {});
            }

            tint(currentTintColor[0], currentTintColor[1], currentTintColor[2], VIDEO_TINT_ALPHA);
            image(overlayVideo, overlayX, overlayY, overlaySize, overlaySize);
            noTint();

            stroke(OVERLAY_BORDER_COLOR[0], OVERLAY_BORDER_COLOR[1], OVERLAY_BORDER_COLOR[2]);
            strokeWeight(OVERLAY_BORDER_WIDTH);
            noFill();
            rect(overlayX, overlayY, overlaySize, overlaySize);
        } else {
            if (
                overlayVideo &&
                currentVideoIndex !== -1 &&
                overlayVideo !== videos[currentVideoIndex]
            ) {
                overlayVideo.pause();
            }

            overlayVisible = false;
            overlayVideo = null;
            nextOverlayCheck = now + OVERLAY_CHECK_INTERVAL;
        }
    } else {
        if (now >= nextOverlayCheck) {
            nextOverlayCheck = now + OVERLAY_CHECK_INTERVAL;

            if (Math.random() < OVERLAY_PROBABILITY) {
                startOverlay();
            }
        }
    }
}

function startOverlay() {
    if (videos.length < 2) return;

    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * videos.length);
    } while (randomIndex === currentVideoIndex);

    overlayVideo = videos[randomIndex];

    overlaySize = random(width * 0.2, width * 0.5);
    overlayX = random(0, width - overlaySize);
    overlayY = random(0, height - overlaySize);

    overlayStartTime = millis();
    overlayVisible = true;

    if (overlayVideo.elt.paused) {
        overlayVideo.elt.play().catch(() => {});
    }
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

function touchStarted() {
    if (videosReady && !playbackStarted) {
        startPlayback();
        return false;
    }
}

function startPlayback() {
    if (playbackStarted) {
        return;
    }

    // Make them loop, but do not force all to start playing
    videos.forEach((vid) => {
        vid.elt.loop = true;
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
        promise.catch(() => {
            console.warn('Video autoplay blocked, will retry on interaction');

            const retryPlay = () => {
                vid.elt.play().catch(() => {});
            };

            document.addEventListener('click', retryPlay, { once: true });
            document.addEventListener('touchstart', retryPlay, { once: true });
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
    if (index === currentVideoIndex) return;

    const previousIndex = currentVideoIndex;
    const previousVideo = previousIndex !== -1 ? videos[previousIndex] : null;
    const newVideo = videos[index];

    currentVideoIndex = index;
    videoSwitchCount += 1;

    if (
        previousVideo &&
        previousIndex !== index &&
        (!overlayVisible || overlayVideo !== previousVideo)
    ) {
        previousVideo.pause();
    }

    if (newVideo && newVideo.elt.paused) {
        ensureVideoPlaying(newVideo);
    }

    if (TINT_RANDOMIZATION_ENABLED && videoSwitchCount >= VIDEO_SWITCHES_PER_TINT) {
        currentTintColor = getRandomTint();
        videoSwitchCount = 0;
    }
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

function initializeControls() {
    document.querySelectorAll('.control-group').forEach(group => {
        const controlName = group.getAttribute('data-control');
        if (controlName && VISIBLE_CONTROLS.hasOwnProperty(controlName)) {
            group.style.display = VISIBLE_CONTROLS[controlName] ? 'block' : 'none';
        }
    });

    const controlsDiv = document.getElementById('controls');
    const toggleButton = document.getElementById('toggle-controls');

    if (window.innerWidth < 600) {
        controlsDiv.classList.add('hidden');
        toggleButton.textContent = 'Show Controls';
    }

    toggleButton.addEventListener('click', () => {
        if (controlsDiv.classList.contains('hidden')) {
            controlsDiv.classList.remove('hidden');
            toggleButton.textContent = 'Hide Controls';
        } else {
            controlsDiv.classList.add('hidden');
            toggleButton.textContent = 'Show Controls';
        }
    });

    document.getElementById('switchInterval').value = SWITCH_INTERVAL;
    document.getElementById('overlayDuration').value = OVERLAY_DURATION;
    document.getElementById('overlayCheckInterval').value = OVERLAY_CHECK_INTERVAL;
    document.getElementById('overlayProbability').value = OVERLAY_PROBABILITY;
    document.getElementById('overlayBorderWidth').value = OVERLAY_BORDER_WIDTH;
    document.getElementById('borderColorR').value = OVERLAY_BORDER_COLOR[0];
    document.getElementById('borderColorG').value = OVERLAY_BORDER_COLOR[1];
    document.getElementById('borderColorB').value = OVERLAY_BORDER_COLOR[2];
    document.getElementById('tintAlpha').value = VIDEO_TINT_ALPHA;
    document.getElementById('switchesPerTint').value = VIDEO_SWITCHES_PER_TINT;
    document.getElementById('tintEnabled').checked = TINT_RANDOMIZATION_ENABLED;

    updateValueDisplays();

    document.getElementById('switchInterval').addEventListener('input', (e) => {
        SWITCH_INTERVAL = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('overlayDuration').addEventListener('input', (e) => {
        OVERLAY_DURATION = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('overlayCheckInterval').addEventListener('input', (e) => {
        OVERLAY_CHECK_INTERVAL = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('overlayProbability').addEventListener('input', (e) => {
        OVERLAY_PROBABILITY = parseFloat(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('overlayBorderWidth').addEventListener('input', (e) => {
        OVERLAY_BORDER_WIDTH = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('borderColorR').addEventListener('input', (e) => {
        OVERLAY_BORDER_COLOR[0] = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('borderColorG').addEventListener('input', (e) => {
        OVERLAY_BORDER_COLOR[1] = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('borderColorB').addEventListener('input', (e) => {
        OVERLAY_BORDER_COLOR[2] = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('tintAlpha').addEventListener('input', (e) => {
        VIDEO_TINT_ALPHA = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('switchesPerTint').addEventListener('input', (e) => {
        VIDEO_SWITCHES_PER_TINT = parseInt(e.target.value);
        updateValueDisplays();
    });

    document.getElementById('tintEnabled').addEventListener('change', (e) => {
        TINT_RANDOMIZATION_ENABLED = e.target.checked;

        if (!TINT_RANDOMIZATION_ENABLED) {
            currentTintColor = [255, 255, 255];
            videoSwitchCount = 0;
        }

        updateValueDisplays();
    });
}

function updateValueDisplays() {
    document.getElementById('switchInterval-val').textContent = `${SWITCH_INTERVAL}ms`;
    document.getElementById('overlayDuration-val').textContent = `${OVERLAY_DURATION}ms`;
    document.getElementById('overlayCheckInterval-val').textContent = `${OVERLAY_CHECK_INTERVAL}ms`;
    document.getElementById('overlayProbability-val').textContent = `${OVERLAY_PROBABILITY.toFixed(1)}`;
    document.getElementById('overlayBorderWidth-val').textContent = `${OVERLAY_BORDER_WIDTH}px`;
    document.getElementById('borderColorR-val').textContent = `${OVERLAY_BORDER_COLOR[0]}`;
    document.getElementById('borderColorG-val').textContent = `${OVERLAY_BORDER_COLOR[1]}`;
    document.getElementById('borderColorB-val').textContent = `${OVERLAY_BORDER_COLOR[2]}`;
    document.getElementById('tintAlpha-val').textContent = `${VIDEO_TINT_ALPHA}`;
    document.getElementById('switchesPerTint-val').textContent = `${VIDEO_SWITCHES_PER_TINT}`;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeControls);
} else {
    initializeControls();
}