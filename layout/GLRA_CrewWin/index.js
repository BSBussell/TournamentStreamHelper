// Tournament Crew Win - TSH Integration

// Global timing configuration
const TIMING_CONFIG = {
    statusCycleInterval: 10000,    // How often status messages change (10 seconds)
    toasterInterval: 15000,       // How often toaster appears (15 seconds)
    toasterDisplayTime: 5000,     // How long toaster stays visible (5 seconds)
};

let config = {
    tournament_name: "Tournament",
    winner_name: "Winner",
    team1_score: 0,
    team2_score: 0,
};

// No countdown functionality needed for crew win screen

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
    'Congratulations to the Winners!',
    'Truly a nail biter!',
    'That was some impressive gameplay from both sides',
    'Wowza, what a battle!',
    'Y\'all should give yourselves a pat on the back',
    'Incredible teamwork displayed',
    'nice one guys',
    'And Congrats to Everyone',
    
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

    // Get crew battle data from window variables
    if (window.winner) {
        config.winner_name = window.winner;
    }
    if (window.p1_score !== undefined) {
        config.team1_score = window.p1_score;
    }
    if (window.p2_score !== undefined) {
        config.team2_score = window.p2_score;
    }

    // Create entrance animation timeline
    entranceAnimation = gsap
        .timeline({ paused: true })
        .set([".main-title", ".event-name", ".score-values", ".loading-text"], { opacity: 0 }, 0)
        .call(() => updateCrewWinInfo(), null, 0.1)
        .to([".main-title"], { duration: 0.8, y: 0, opacity: 1, ease: "power2.out" }, 0.2)
        .to([".event-name"], { duration: 0.6, opacity: 1, ease: "power2.out" }, 0.5)
        .to([".score-values"], { duration: 0.8, opacity: 1, ease: "power2.out" }, 0.8)
        .to([".loading-text"], { duration: 0.6, opacity: 1, ease: "power2.out" }, 1.1)
        .to([".bg-circle"], { duration: 1, scale: 1, opacity: 0.1, ease: "power2.out", stagger: 0.2 }, 0.6);

    // Initialize status message cycling
    statusInterval = setInterval(cycleStatusMessage, TIMING_CONFIG.statusCycleInterval);

    // Initialize toaster cycling
    toasterInterval = setInterval(showFollowToaster, TIMING_CONFIG.toasterInterval);

    Start = async (event) => {
        entranceAnimation.restart();
    };

    Update = async (event) => {
        let data = event.data;
        let oldData = event.oldData;

        console.log("GLRA Crew Win UPDATE -------------------");

        // Update tournament info from TSH data structure
        if (data.tournamentInfo) {
            if (data.tournamentInfo.tournamentName) {
                config.tournament_name = data.tournamentInfo.tournamentName;
            }
        }

        updateCrewWinInfo();
    };
});

function updateCrewWinInfo() {
    // Update winner name with wave effect and "Wins" in white
    const winnerElement = document.getElementById('winner');
    if (winnerElement) {
        // Create wave effect for winner name, then add white "Wins"
        const waveWinnerName = wrapTextForWave(config.winner_name);
        winnerElement.innerHTML = `<div class="wave-text">${waveWinnerName}</div> <span style="color: white;">Wins</span>`;
    }

    // Update tournament name
    const tournamentElement = document.getElementById('main-title');
    if (tournamentElement) {
        const displayTournament = config.tournament_name || "Tournament Name";
        SetInnerHtml($(tournamentElement), `- ${displayTournament} -`);
    }

    // Update scores
    const team1ScoreElement = document.getElementById('team1-score');
    const team2ScoreElement = document.getElementById('team2-score');
    if (team1ScoreElement) {
        team1ScoreElement.textContent = config.team1_score;
    }
    if (team2ScoreElement) {
        team2ScoreElement.textContent = config.team2_score;
    }

    // Initialize loading text with first message
    const loadingElement = document.getElementById('loading-text');
    if (loadingElement && !loadingElement.textContent) {
        statusMessages = shuffleArray(originalStatusMessages);
        loadingElement.textContent = statusMessages[0];
        currentStatusIndex = 1;
    }
}

function cycleStatusMessage() {
    const loadingElement = document.getElementById('loading-text');
    
    // Ensure elements exist before proceeding
    if (!loadingElement) {
        console.warn("Loading element not found, skipping cycle");
        return;
    }
    
    // Animate text change
    gsap.to(loadingElement, {
        duration: 0.2,
        opacity: 0,
        y: -10,
        ease: "power2.in",
        onComplete: () => {
            if (loadingElement) {
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