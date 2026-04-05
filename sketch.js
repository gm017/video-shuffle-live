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

// Detect mobile device
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               ('ontouchstart' in window) || 
               (window.innerWidth <= 800 && window.innerHeight <= 600);

// Mobile-specific variables
let mobilePlayAttempts = 0;
let maxMobilePlayAttempts = 5;
let mobileFallbackMode = false;

// Timing configuration

let SWITCH_INTERVAL = 2000;
let OVERLAY_DURATION = 3000;
let OVERLAY_CHECK_INTERVAL = 2000;
let OVERLAY_PROBABILITY = 0.5;

// Overlay border configuration
let OVERLAY_BORDER_COLOR = [255, 0, 0]; // RGB
let OVERLAY_BORDER_WIDTH = 0;

// Video tint configuration
let VIDEO_TINT_ALPHA = 255;
let VIDEO_SWITCHES_PER_TINT = 1; // Change tint color every N video switches 
let TINT_RANDOMIZATION_ENABLED = false; // Set to false to disable random colour changes 

// Control visibility - set to false to hide controls
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


    // Initialize tint color
    if (TINT_RANDOMIZATION_ENABLED) {
        currentTintColor = getRandomTint();
    } else {
        currentTintColor = [255, 255, 255]; // Default white tint (no change)
    }
    videoSwitchCount = 0;

    for (let i = 1; i <= 9; i++) {
        const vid = createVideo([`assets/video/tiny/vid${i}.mp4`]);
        prepareVideo(vid);
        videos.push(vid);
        
        // On mobile, try to load videos immediately and add extra event listeners
        if (isMobile) {
            vid.elt.load();
            vid.elt.addEventListener('loadstart', () => console.log(`Video ${i} load started`));
            vid.elt.addEventListener('progress', () => console.log(`Video ${i} loading progress`));
            vid.elt.addEventListener('canplay', () => console.log(`Video ${i} can play`));
        }
    }

    initVideoOrder();
}

function prepareVideo(vid) {
    vid.hide();
    // Make video responsive to screen size
    vid.size(min(width, 640), min(height, 360));
    vid.volume(0);
    vid.attribute('muted', '');
    vid.attribute('playsinline', '');
    vid.attribute('preload', 'auto');
    vid.elt.muted = true;
    vid.elt.playsInline = true;
    vid.elt.addEventListener('canplaythrough', onVideoLoaded);
    vid.elt.addEventListener('error', (e) => {
        console.error('Video load error:', e);
    });
    vid.elt.addEventListener('loadeddata', () => {
        console.log('Video loaded data');
    });
}

function onVideoLoaded() {
    loadedCount += 1;
    console.log(`Video ${loadedCount} loaded`);
    if (loadedCount === videos.length) {
        videosReady = true;
        console.log('All videos ready!');
    }
}

function draw() {
    background(255);

    if (!videosReady) {
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(min(24, width / 20));
        text('Loading videos...\nPlease wait', width / 2, height / 2);
        return;
    }

    if (!playbackStarted) {
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(min(24, width / 20));
        let message = 'click';
        if (isMobile) {
            message += '\n(Mobile detected)';
            if (videosReady) {
                message += '\nVideos loaded!';
            } else {
                message += '\nLoading videos...';
            }
        }
        text(message, width / 2, height / 2);
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

    // Ensure main video stays playing (more aggressive on mobile)
    if (playbackStarted && videos[currentVideoIndex]) {
        if (videos[currentVideoIndex].elt.paused) {
            if (isMobile) {
                mobilePlayAttempts++;
                if (mobilePlayAttempts < maxMobilePlayAttempts) {
                    // On mobile, try multiple times with delay
                    setTimeout(() => {
                        if (videos[currentVideoIndex] && videos[currentVideoIndex].elt.paused) {
                            videos[currentVideoIndex].elt.play().catch(() => {
                                console.log('Mobile video play failed, attempt', mobilePlayAttempts);
                            });
                        }
                    }, 100 * mobilePlayAttempts);
                } else {
                    // Show error message after max attempts
                    fill(255, 0, 0);
                    textAlign(CENTER, CENTER);
                    textSize(min(20, width / 25));
                    text('Video playback blocked\nTry refreshing the page\nor use desktop browser', width / 2, height / 2);
                    return;
                }
            } else {
                videos[currentVideoIndex].elt.play().catch(() => { });
            }
        } else {
            mobilePlayAttempts = 0; // Reset on successful play
        }
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
                overlayVideo.elt.play().catch(() => { });
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

// Add touch support for mobile
function touchStarted() {
    if (videosReady && !playbackStarted) {
        console.log('Touch detected, starting playback');
        startPlayback();
        return false; // Prevent default touch behavior
    }
    // Allow continued touch interaction
    return true;
}

function startPlayback() {
    if (playbackStarted) {
        return;
    }

    console.log('Starting playback, isMobile:', isMobile);
    
    videos.forEach((vid, index) => {
        vid.loop();
        // On mobile, only try to play if video is ready
        if (!isMobile || vid.elt.readyState >= 3) { // HAVE_FUTURE_DATA or higher
            ensureVideoPlaying(vid);
        }
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
            .then(() => { })
            .catch((error) => {
                console.warn('Video autoplay blocked, will retry on interaction');
                // Retry on next user interaction (click or touch)
                const retryPlay = () => {
                    vid.elt.play().catch(() => { });
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
    currentVideoIndex = index;
    videoSwitchCount += 1;

    // Pause all other videos to reduce CPU load
    for (let i = 0; i < videos.length; i++) {
        if (i !== index) {
            videos[i].pause();
        }
    }

    // On mobile, ensure the current video is set to loop and try to play if ready
    if (isMobile && videos[index]) {
        videos[index].loop();
        if (videos[index].elt.readyState >= 3) { // HAVE_FUTURE_DATA
            ensureVideoPlaying(videos[index]);
        }
    }

    // Change tint after every N switches (if randomization is enabled)
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

// Initialize and set up input controls
function initializeControls() {
    // Apply visibility settings
    document.querySelectorAll('.control-group').forEach(group => {
        const controlName = group.getAttribute('data-control');
        if (controlName && VISIBLE_CONTROLS.hasOwnProperty(controlName)) {
            group.style.display = VISIBLE_CONTROLS[controlName] ? 'block' : 'none';
        }
    });
    
    // Hide controls on very small screens by default
    const controlsDiv = document.getElementById('controls');
    const toggleButton = document.getElementById('toggle-controls');
    
    if (window.innerWidth < 600) {
        controlsDiv.classList.add('hidden');
        toggleButton.textContent = 'Show Controls';
    }
    
    // Set up toggle button
    toggleButton.addEventListener('click', () => {
        if (controlsDiv.classList.contains('hidden')) {
            controlsDiv.classList.remove('hidden');
            toggleButton.textContent = 'Hide Controls';
        } else {
            controlsDiv.classList.add('hidden');
            toggleButton.textContent = 'Show Controls';
        }
    });
    
    // Add direct mobile touch listener
    if (isMobile) {
        document.addEventListener('touchstart', (e) => {
            if (videosReady && !playbackStarted) {
                console.log('Direct touch detected, starting playback');
                e.preventDefault();
                startPlayback();
            }
        }, { passive: false });
    }
    
    // Set initial values
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
    
    // Add event listeners
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
            // Reset to default white tint when disabled
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

// Initialize controls when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeControls);
} else {
    initializeControls();
}
