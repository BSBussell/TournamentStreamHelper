// Tournament Thanks - TSH Integration

const TIMING_CONFIG = {
    toasterInterval: 15000,
    toasterDisplayTime: 5000,
};

let config = {
    main_title: "Tennessee Hive",
    tournament_name: "Tournament",
};

let toasterInterval;
let entranceAnimation;

LoadEverything().then(() => {
    const windowConfig = window.config || {};

    function isDefault(value) {
        return value === "" || value === -1 || value === undefined || value === null;
    }

    function assignDefault(target, source) {
        for (const key in target) {
            const value = source[key];
            if (typeof value === "object" && value !== null) {
                const matchingObject = target[key];
                if (typeof matchingObject !== "object") {
                    target[key] = value;
                } else {
                    assignDefault(matchingObject, value);
                }
            } else if (!isDefault(value)) {
                target[key] = value;
            }
        }
    }

    assignDefault(config, tsh_settings);
    assignDefault(config, windowConfig);

    entranceAnimation = gsap
        .timeline({ paused: true })
        .set(
            [
                ".eyebrow",
                ".main-title",
                ".thanks-subtitle",
                ".tournament-name",
                ".starting-label",
            ],
            { opacity: 0 },
            0,
        )
        .set(".main-content", { y: 28 }, 0)
        .call(updateTournamentInfo, null, 0.1)
        .to(".main-content", { duration: 1.1, y: 0, ease: "power3.out" }, 0.12)
        .to(".eyebrow", { duration: 0.45, opacity: 1, ease: "power2.out" }, 0.2)
        .to(".main-title", { duration: 0.8, opacity: 1, ease: "power2.out" }, 0.35)
        .to(".thanks-subtitle", { duration: 0.55, opacity: 1, ease: "power2.out" }, 0.76)
        .to(".tournament-name", { duration: 0.45, opacity: 1, ease: "power2.out" }, 1.03)
        .to(".starting-label", { duration: 0.45, opacity: 1, ease: "power2.out" }, 1.23);

    toasterInterval = setInterval(showFollowToaster, TIMING_CONFIG.toasterInterval);

    Start = async () => {
        entranceAnimation.restart();
    };

    Update = async (event) => {
        const data = event.data;

        if (data.tournamentInfo?.tournamentName) {
            config.tournament_name = data.tournamentInfo.tournamentName;
        }

        updateTournamentInfo();
    };
});

function updateTournamentInfo() {
    const titleElement = document.getElementById("main-title");
    if (titleElement) {
        titleElement.textContent = config.main_title;
    }

    const tournamentNameElement = document.getElementById("tournament-name");
    if (tournamentNameElement) {
        tournamentNameElement.textContent = config.tournament_name || "Tournament";
    }

    const farewellElement = document.querySelector(".starting-label");
    if (farewellElement) {
        farewellElement.textContent = "Thanks for sharing the night with us.";
    }
}

function showFollowToaster() {
    const toaster = document.getElementById("follow-toaster");
    if (!toaster) return;

    gsap.killTweensOf(toaster);
    gsap.to(toaster, {
        duration: 0.5,
        right: "44px",
        ease: "power2.out",
        onComplete: () => {
            setTimeout(() => {
                gsap.to(toaster, {
                    duration: 0.5,
                    right: "-560px",
                    ease: "power2.in",
                });
            }, TIMING_CONFIG.toasterDisplayTime);
        },
    });
}
