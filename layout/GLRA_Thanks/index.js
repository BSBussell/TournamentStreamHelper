// Tournament Thanks - TSH Integration

// Global timing configuration
const TIMING_CONFIG = {
    statusCycleInterval: 10000,    // How often status messages change (10 seconds)
    toasterInterval: 15000,       // How often toaster appears (15 seconds)
    toasterDisplayTime: 5000,     // How long toaster stays visible (5 seconds)
    blurIntensifyDuration: 3000,  // How long to intensify blur
};

let config = {
    main_title: "The Tennessee Gorilla",
    tournament_name: "Tournament", // This will get the actual tournament name
    show_countdown: false, // No countdown for thanks screen
};

// No countdown functionality needed for thanks screen

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
    'Thanks for watching!',
    'See you next time!',
    'Hope you enjoyed the stream',
    'Follow us for more tournaments',
    'Great games tonight!',
    'Stream ending soon',
    'Thanks for your support',
    'Until next time!',
    'Good night everyone!',
    'Sweet dreams!',
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

    // No countdown for thanks screen - remove countdown-related functionality

    // Create entrance animation timeline (no countdown elements)
    entranceAnimation = gsap
        .timeline({ paused: true })
        .set([".main-title", ".thanks-subtitle", ".tournament-name", ".starting-label"], { opacity: 0 }, 0) // Hide text elements
        .call(() => updateTournamentInfo(), null, 0.1) // Update content after clearing
        .to([".main-title"], { duration: 0.8, y: 0, opacity: 1, ease: "power2.out" }, 0.2)
        .to([".thanks-subtitle"], { duration: 0.6, opacity: 1, ease: "power2.out" }, 0.5)
        .to([".tournament-name"], { duration: 0.6, opacity: 1, ease: "power2.out" }, 0.8)
        .to([".starting-label"], { duration: 0.6, opacity: 1, ease: "power2.out" }, 1.1)
        .to([".bg-circle"], { duration: 1, scale: 1, opacity: 0.1, ease: "power2.out", stagger: 0.2 }, 0.6);

    // Initialize status message cycling (if loading text exists)
    const loadingElement = document.getElementById('loading-text');
    if (loadingElement) {
        statusInterval = setInterval(cycleStatusMessage, TIMING_CONFIG.statusCycleInterval);
        
        // Start the first loading bar animation if it exists
        const loadingFill = document.querySelector('.loading-fill');
        if (loadingFill) {
            gsap.killTweensOf(loadingFill);
            gsap.set(loadingFill, { width: "0%" });
            gsap.to(loadingFill, {
                duration: TIMING_CONFIG.statusCycleInterval / 1000,
                width: "100%",
                ease: "linear"
            });
        }
    }

    // Initialize toaster cycling
    toasterInterval = setInterval(showFollowToaster, TIMING_CONFIG.toasterInterval);

    Start = async (event) => {
        entranceAnimation.restart();
    };

    Update = async (event) => {
        let data = event.data;
        let oldData = event.oldData;

        console.log("GLRA Thanks UPDATE -------------------");

        // Update tournament info from TSH data structure
        if (data.tournamentInfo) {
            // Get tournament name from tournament info
            if (data.tournamentInfo.tournamentName) {
                config.tournament_name = data.tournamentInfo.tournamentName;
            }

            // Get event name if available (for potential future use)
            if (data.tournamentInfo.eventName) {
                config.event_name = data.tournamentInfo.eventName;
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
    // Update main title with wave effect (always "The Tennessee Gorilla")
    const titleElement = document.getElementById('main-title');
    if (titleElement) {
        applyWaveText(titleElement, config.main_title);
    }

    // Update tournament name (the actual tournament name from TSH)
    const tournamentNameElement = document.getElementById('tournament-name');
    if (tournamentNameElement) {
        const displayTournament = config.tournament_name || "Tournament";
        SetInnerHtml($(tournamentNameElement), `- ${displayTournament} -`);
    }

    // Update the "starting label" to "Have a Good Night!"
    const startingLabelElement = document.querySelector('.starting-label');
    if (startingLabelElement) {
        startingLabelElement.textContent = "Have a Good Night!";
    }

    // Initialize loading text with first message if it exists
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
    if (!loadingElement) {
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
    
    // Reset and animate loading bar if it exists
    if (loadingFill) {
        gsap.killTweensOf(loadingFill);
        gsap.set(loadingFill, { width: "0%" });
        gsap.to(loadingFill, {
            duration: TIMING_CONFIG.statusCycleInterval / 1000,
            width: "100%",
            ease: "linear"
        });
    }
}

// No countdown animation needed for thanks screen

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