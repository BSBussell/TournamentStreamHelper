// Tournament Starting Soon - TSH Integration

// Global timing configuration
const TIMING_CONFIG = {
    statusCycleInterval: 10000,    // How often status messages change (3 seconds)
    toasterInterval: 15000,       // How often toaster appears (30 seconds)
    toasterDisplayTime: 5000,     // How long toaster stays visible (5 seconds)
    loadingBarDuration: 10000,    // Loading bar animation duration (10 seconds, matches status cycle)
    blurIntensifyDuration: 3000,  // How long to intensify blur after countdown
    countdownTestDuration: 30000  // Default countdown time for testing (30 seconds)
};

let config = {
    tournament_name: "Tournament",
    event_name: "",
    start_time: null, // Will be calculated
    target_time: null, // URL parameter or 5 min from now
    show_countdown: true,
};

// Get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Parse time string like "8:30PM" to Date object for today
function parseTimeString(timeStr) {
    if (!timeStr) return null;

    try {
        const today = new Date();
        const [time, period] = timeStr.split(/([AP]M)/i);
        const [hours, minutes] = time.split(':').map(num => parseInt(num));

        let hour24 = hours;
        if (period && period.toUpperCase() === 'PM' && hours !== 12) {
            hour24 += 12;
        } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
            hour24 = 0;
        }

        const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour24, minutes || 0);

        // If the time has passed today, assume it's for tomorrow
        if (targetDate < new Date()) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        return targetDate;
    } catch (e) {
        console.log("Time parsing error:", e);
        return null;
    }
}

// Calculate countdown time
function updateCountdown() {
    if (!config.target_time) return;

    const now = new Date();
    const diff = config.target_time - now;

    if (diff <= 0) {
        // Clear the countdown interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        // Trigger the fade out animation
        triggerFadeOutAnimation();
        return;
    }

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const newTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const timerElement = document.getElementById('countdown-timer');
    if (timerElement) {
        const currentTime = timerElement.textContent;
        
        // Always update the time consistently, no animation needed
        if (currentTime !== newTime) {
            timerElement.textContent = newTime;
        }
    }
}

let countdownInterval;

// Function to wrap text in spans for wave animation
function wrapTextForWave(text) {
    return text.split('').map(char => {
        // Preserve spaces but still wrap them
        if (char === ' ') {
            return '<span>&nbsp;</span>';
        }
        return `<span>${char}</span>`;
    }).join('');
}

// Function to apply wave effect to element
function applyWaveText(element, text) {
    element.innerHTML = `<div class="wave-text">${wrapTextForWave(text)}</div>`;
}

// Animation cycle for status messages
const originalStatusMessages = [
    'Buzzing around',
    'Rigging the Bracket',
    'Power Napping',
    'Debugging the Replay Script',
    'Designing new layouts',
    'Seeding Bracket again',
    'Waiting for the T.O. to show up',
    'Practicing the Worm',
    'Counting my Pollen Points',
    'Refilling our water bottles',
    'Bumbling around',
    'Getting in their heads',
    'Breaking the rules',
    'Making you wait for absolutely no reason',
    'Practicing dancing behind the players',
    'Talking to Nutpea',
    'Spending too much time building the playlist',
    'Bee stayed up til 5am making this screen',
    'Bee doesn\'t know why she did that',
    'Hopefully we\'ll be starting soon',
    'installing vine sound effects',
    'manifesting a SmokedSam win',
    'Up to no good',
    'Fighting crime by daylight',
    'Heavily considering starting a comedy podcast',
    'Searching for a McGuffin',
    'Getting out of bed',
    'Searching for Big Mama',
    'Researching Smash Timeout Rules',
    'Watching Star Trek: Voyager',
    'Listening to Loveland',
    'Trying to find the HDMI cable',
    'Trying to find the WiFi password',
    'Waiting for start.gg to load',
    'Wondering where everyone went',
    'Trying to get the projector to work',
    'Wondering if anyone brought snacks',
    'Wondering why OBS crashed',
    'Wondering if anyone noticed the typo',
    'Making an Etch A Sketch program for Twitch Viewers',
    "Considering what I would do for a legal yoshi's island (brawl)",
    "Considering what I would do for a legal yoshi's island (melee)",
    'Reconsidering font choices',
    'Pre-regging for Evo 2018',
    'Time Traveling Storm to beat Cosmos',
    'Neuron Activation Via Diddy Kong Movement',
    'Throwing away a stitch',
    "Practicing Hidalgo's patented luigi combos",
    'Samsplaining Hive Code',
    'Moneymatches anyone?',
    'What purple is he directing?',
    'Voting Reiko for president of UTC eSports',
    'Hutchzilla must now be called SDI-yler',
    'Hoping m0use wins this whole thing',
    'Memorizing sound fonts',
];

// Fisher-Yates shuffle
function shuffleArray(array) {
    let arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Fisher-Yates shuffle for status messages
function shuffleStatusMessages() {
    for (let i = statusMessages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [statusMessages[i], statusMessages[j]] = [statusMessages[j], statusMessages[i]];
    }
}

let statusMessages = shuffleArray(originalStatusMessages);
let currentStatusIndex = 0;
let statusInterval;
let toasterInterval;
let entranceAnimation;

LoadEverything().then(() => {
    let window_config = window.config || {};

    function isDefault(value) {
        return (
            value === "" ||
            value === -1 ||
            value === undefined ||
            value === null
        );
    }

    function assignDefault(target, source) {
        for (k in target) {
            let value = source[k];
            if (typeof value === "object" && value !== null) {
                let matchingObject = target[k];
                if (typeof matchingObject != "object") {
                    matchingObject = value;
                } else {
                    assignDefault(matchingObject, value);
                }
            }
            if (!isDefault(value)) {
                target[k] = value;
            }
        }
    }

    assignDefault(config, tsh_settings);
    assignDefault(config, window_config);

    // Set up target time from URL parameter or default to test duration
    // const urlTime = getUrlParameter('start_time');
    const urlTime = window.start_time || getUrlParameter('start_time');
    if (urlTime) {
        config.target_time = parseTimeString(urlTime);
    } else {
        config.target_time = new Date(Date.now() + TIMING_CONFIG.countdownTestDuration);
    }

    // Start countdown timer
    if (config.target_time) {
        countdownInterval = setInterval(updateCountdown, 1000);
        updateCountdown(); // Initial update
    }

    // Create entrance animation timeline
    entranceAnimation = gsap
        .timeline({ paused: true })
        .set([".main-title", ".event-name", ".starting-label", ".big-timer", ".loading-text"], { opacity: 0 }, 0) // Hide all text elements
        .call(() => updateTournamentInfo(), null, 0.1) // Update content after clearing
        .to([".main-title"], { duration: 0.8, y: 0, opacity: 1, ease: "power2.out" }, 0.2)
        .to([".event-name"], { duration: 0.6, opacity: 1, ease: "power2.out" }, 0.4)
        .to([".starting-label"], { duration: 0.6, opacity: 1, ease: "power2.out" }, 0.8)
        .to([".big-timer"], { duration: 0.8, opacity: 1, ease: "power2.out" }, 1.0)
        .to([".loading-bar"], { duration: 0.6, opacity: 1, ease: "power2.out" }, 1.2)
        .to([".loading-text"], { duration: 0.4, opacity: 1, ease: "power2.out" }, 1.4)
        .to([".bg-circle"], { duration: 1, scale: 1, opacity: 0.1, ease: "power2.out", stagger: 0.2 }, 0.6);

    // Initialize status message cycling with synced loading bar
    statusInterval = setInterval(cycleStatusMessage, TIMING_CONFIG.statusCycleInterval);
    
    // Start the first loading bar animation immediately
    const loadingFill = document.querySelector('.loading-fill');
    if (loadingFill) {
        gsap.killTweensOf(loadingFill); // Kill any existing animations
        gsap.set(loadingFill, { width: "0%" });
        gsap.to(loadingFill, {
            duration: TIMING_CONFIG.loadingBarDuration / 1000,
            width: "100%",
            ease: "linear"
        });
    }

    // Initialize toaster cycling
    toasterInterval = setInterval(showFollowToaster, TIMING_CONFIG.toasterInterval);

    Start = async (event) => {
        entranceAnimation.restart();
    };

    Update = async (event) => {
        let data = event.data;
        let oldData = event.oldData;

        console.log("HIVE Starting Soon UPDATE -------------------");

        // Update tournament info from TSH data structure
        if (data.tournamentInfo) {
            if (data.tournamentInfo.tournamentName) {
                config.tournament_name = data.tournamentInfo.tournamentName;
            }

            // Get event name from tournament info
            if (data.tournamentInfo.eventName) {
                config.event_name = data.tournamentInfo.eventName;
            }

            // Parse the date from startAt or endAt (keeping for potential future use)
            if (data.tournamentInfo.startAt) {
                try {
                    const dateStr = data.tournamentInfo.startAt;
                    let parsedDate;

                    // Handle different date formats
                    if (dateStr.includes('/')) {
                        // Format like "6/28/25" or "06/28/2025"
                        const parts = dateStr.split('/');
                        if (parts.length === 3) {
                            let month = parseInt(parts[0]);
                            let day = parseInt(parts[1]);
                            let year = parseInt(parts[2]);

                            // Handle 2-digit years
                            if (year < 100) {
                                year += 2000;
                            }

                            parsedDate = new Date(year, month - 1, day);
                        }
                    } else {
                        // Try standard date parsing
                        parsedDate = new Date(dateStr);
                    }

                    if (parsedDate && !isNaN(parsedDate)) {
                        config.tournament_date = parsedDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                } catch (e) {
                    console.log("Date parsing error:", e);
                }
            }

            // Update game info if available
            if (data.game && data.game.name) {
                config.game_name = data.game.name;
            }
        }

        updateTournamentInfo();
    };
});

function updateTournamentInfo() {
    // Update tournament name in the main heading with wave effect
    const titleElement = document.getElementById('main-title');
    if (titleElement && config.tournament_name) {
        applyWaveText(titleElement, config.tournament_name);
    }

    // Update event name (no wave effect)
    const eventElement = document.getElementById('event-name');
    if (eventElement) {
        const displayEvent = config.event_name || "Event Name";
        SetInnerHtml($(eventElement), `- ${displayEvent} -`);
    }

    // Initialize loading text with first message
    const loadingElement = document.getElementById('loading-text');
    if (loadingElement && !loadingElement.textContent) {
        // Shuffle for first cycle
        statusMessages = shuffleArray(originalStatusMessages);
        loadingElement.textContent = statusMessages[0];
        currentStatusIndex = 1; // Start cycling from the second message
    }
}

function cycleStatusMessage() {
    const loadingElement = document.getElementById('loading-text');
    const loadingFill = document.querySelector('.loading-fill');
    
    // Ensure elements exist before proceeding
    if (!loadingElement || !loadingFill) {
        console.warn("Loading elements not found, skipping cycle");
        return;
    }
    
    // Animate text change
    gsap.to(loadingElement, {
        duration: 0.2,
        opacity: 0,
        y: -10,
        ease: "power2.in",
        onComplete: () => {
            if (loadingElement) { // Double-check element still exists
                loadingElement.textContent = statusMessages[currentStatusIndex];
                currentStatusIndex = (currentStatusIndex + 1) % statusMessages.length;
                // Shuffle when we complete a full cycle
                if (currentStatusIndex === 0) {
                    shuffleStatusMessages();
                }
                gsap.to(loadingElement, {
                    duration: 0.2,
                    opacity: 1,
                    y: 0,
                    ease: "power2.out"
                });
            }
        }
    });
    
    // Reset and animate loading bar to sync with status cycle
    if (loadingFill) {
        gsap.killTweensOf(loadingFill); // Kill any existing animations
        gsap.set(loadingFill, { width: "0%" });
        gsap.to(loadingFill, {
            duration: TIMING_CONFIG.loadingBarDuration / 1000, // Convert to seconds for GSAP
            width: "100%",
            ease: "linear"
        });
    }
}

// Animation when timer hits zero - fade out then blur intensification
function triggerFadeOutAnimation() {
    // Stop status message cycling
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }

    // Stop toaster cycling
    if (toasterInterval) {
        clearInterval(toasterInterval);
        toasterInterval = null;
    }

    // Ensure elements exist before animating
    const overlayContainer = document.querySelector(".overlay-container");
    const blurOverlay = document.querySelector(".blur-overlay");
    
    if (!overlayContainer || !blurOverlay) {
        console.warn("Animation elements not found, skipping fade out");
        return;
    }

    // Create fade out animation followed by blur intensification
    const fadeOutAnimation = gsap
        .timeline()
        .to(overlayContainer, {
            duration: 2,
            opacity: 0,
            ease: "power2.inOut"
        }, 0)
        .to(blurOverlay, {
            duration: TIMING_CONFIG.blurIntensifyDuration / 1000, // Convert to seconds
            backdropFilter: "blur(50px)",
            ease: "power2.inOut"
        }, 2); // Start blur after fade completes
}

// Toaster animation for follow button
function showFollowToaster() {
    const toaster = document.getElementById('follow-toaster');
    if (!toaster) {
        console.warn("Follow toaster element not found");
        return;
    }
    
    // Kill any existing animations on the toaster
    gsap.killTweensOf(toaster);
    
    // Slide in from the right
    gsap.to(toaster, {
        duration: 0.5,
        right: "30px",
        ease: "power2.out",
        onComplete: () => {
            // Stay visible for configured time, then slide out
            setTimeout(() => {
                if (toaster) { // Ensure element still exists
                    gsap.to(toaster, {
                        duration: 0.5,
                        right: "-500px",
                        ease: "power2.in"
                    });
                }
            }, TIMING_CONFIG.toasterDisplayTime);
        }
    });
}