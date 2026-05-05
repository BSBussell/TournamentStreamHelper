const DEFAULT_RANKING_JSON = "./player_placements_startgg.json";
const FALLBACK_PFP = "./person.svg";
const FINAL_LEADERBOARD_TITLE = "Knoxville Spring 26 PR";
const FINAL_COLLAGE_IMAGE = "./collage/characters-wreath.png";
const THUNDER_SFX = "./sfx/thunder.mp3";
const THUNDER_SFX_PLAYBACK_RATE = 1.12;
const TEASER_TIP_INTERVAL_MS = 5200;
const LEADERBOARD_FLASH_SFX_DELAY_MS = 990;
const TEASER_LOADING_TIPS = [
    "Could be convinced to open a prediction for PR placements.",
    "Rigging the PR stats.",
    "Starting PR discourse again.",
    "Ignoring PR elligibility rules.",
    "Gaslighting the PR committee.",
    "GateKeeping the PR committee.",
    "GirlBossing the PR committee.",
    "DDOS attacking braacket to make everyones life miserable.",
    "Wondering why the PR scene crashed OBS.",
    "Scheming to abolish PR and replace it with a more woke alternative.",
];

let rankedPlayers = [];
let currentIndex = 0;
let currentView = "teaser";
let transitionLocked = true;
let characterRenderToken = 0;
let teaserTipIndex = 0;
let teaserLoadingTween = null;
let thunderAudio = null;
let openingCharacterPreloadPromise = null;
const jsonCache = {};

let config = {
    ranking_json: DEFAULT_RANKING_JSON,
    start_placement: 10,
    character_asset_pack: "webm",
    character_game: "ssbu",
};

function getNumberOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

function isDefault(value) {
    return value === "" || value === -1 || value === undefined || value === null;
}

function assignDefault(target, source) {
    for (const key in source) {
        const value = source[key];
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            if (typeof target[key] !== "object" || target[key] === null) {
                target[key] = {};
            }
            assignDefault(target[key], value);
        } else if (!isDefault(value)) {
            target[key] = value;
        }
    }
}

async function loadRankingJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Could not load ${path}: HTTP ${response.status}`);
    }
    return response.json();
}

async function loadJsonCached(path) {
    if (!jsonCache[path]) {
        jsonCache[path] = fetch(path, { cache: "no-store" }).then((response) => {
            if (!response.ok) {
                throw new Error(`Could not load ${path}: HTTP ${response.status}`);
            }
            return response.json();
        });
    }
    return jsonCache[path];
}

function getProfileImage(player) {
    if (player.pfp) return player.pfp;

    const images = _.get(player, "startgg.images", []);
    const profile = images.find((image) => image && image.type === "profile" && image.url);
    if (profile) return profile.url;

    const firstImage = images.find((image) => image && image.url);
    return firstImage ? firstImage.url : FALLBACK_PFP;
}

function sanitizeRankedPlayers(rawData) {
    const rawPlayers = Array.isArray(rawData.players) ? rawData.players : [];
    const validPlayers = rawPlayers
        .map((player) => ({
            ...player,
            placement: Number(player.placement),
            pfp: getProfileImage(player),
        }))
        .filter((player) => Number.isFinite(player.placement) && player.placement > 0 && player.tag);

    validPlayers.sort((a, b) => a.placement - b.placement);
    return validPlayers;
}

function getStartingIndex(players) {
    if (players.length === 0) return 0;

    const requestedPlacement = Number(config.start_placement || 10);
    let index = players.findIndex((player) => player.placement === requestedPlacement);
    if (index !== -1) return index;

    const availableAtOrBelowStart = players.filter((player) => player.placement <= requestedPlacement);
    if (availableAtOrBelowStart.length > 0) {
        const lowestPlacement = Math.max(...availableAtOrBelowStart.map((player) => player.placement));
        return players.findIndex((player) => player.placement === lowestPlacement);
    }

    return players.length - 1;
}

function getCurrentPlayer() {
    return rankedPlayers[currentIndex] || null;
}

function getPlayerDisplayName(player) {
    const gamerTag = _.get(player, "startgg.gamerTag") || player.tag || "";
    const prefix = _.get(player, "startgg.prefix") || "";
    return prefix ? `${prefix} | ${gamerTag}` : gamerTag;
}

function getPlayerGamerTag(player) {
    return _.get(player, "startgg.gamerTag") || player.tag || "";
}

function getPlayerPrefix(player) {
    return _.get(player, "startgg.prefix") || "";
}

function getPlayerSponsor(player) {
    const prefix = getPlayerPrefix(player);
    return prefix ? prefix.trim() : "";
}

function getPlacementHeat(placement) {
    if (placement <= 1) return 1;
    if (placement === 2) return 0.78;
    if (placement === 3) return 0.55;
    return Math.max(0, Math.min(0.34, (10 - placement) / 18));
}

function getPlacementTheme(placement) {
    if (placement <= 1) {
        return {
            accent: "#f6a900",
            strong: "#ffe78a",
            dark: "#8a4d00",
            soft: "rgba(255, 184, 28, 0.22)",
        };
    }

    if (placement === 2) {
        return {
            accent: "#b8cfe8",
            strong: "#edf7ff",
            dark: "#4a6075",
            soft: "rgba(154, 193, 230, 0.18)",
        };
    }

    if (placement === 3) {
        return {
            accent: "#c87532",
            strong: "#ffd09a",
            dark: "#6d2f10",
            soft: "rgba(210, 112, 42, 0.3)",
        };
    }

    if (placement <= 6) {
        return {
            accent: "#ff9d1b",
            strong: "#ffe06a",
            dark: "#9b3900",
            soft: "rgba(255, 150, 24, 0.3)",
        };
    }

    return {
        accent: "#ff7418",
        strong: "#ffc247",
        dark: "#8f2500",
        soft: "rgba(255, 103, 16, 0.28)",
    };
}

function getRankGlowSettings(placement) {
    const heat = getPlacementHeat(placement);
    const withMotionSettings = (settings) => ({
        ...settings,
        extraWide: settings.wide * 1.24,
        innerGlowSize: Math.max(2, settings.tight * 0.25),
        flickerLowBrightness: 1 + settings.heat * 0.05,
        flickerPeakBrightness: 1 + settings.heat * 0.12,
        flickerSettleBrightness: 1 + settings.heat * 0.07,
        flickerLateBrightness: 1 + settings.heat * 0.1,
        flickerLowSaturation: 1 + settings.heat * 0.04,
        flickerPeakSaturation: 1 + settings.heat * 0.08,
        flickerSettleSaturation: 1 + settings.heat * 0.05,
        flickerLateSaturation: 1 + settings.heat * 0.07,
        auraHotScale: 1.01 + settings.heat * 0.035,
    });

    if (placement <= 1) {
        return withMotionSettings({
            heat: 1,
            tight: 12,
            wide: 54,
            auraOpacity: 0.46,
            auraRestOpacity: 0.26,
            innerGlowOpacity: 0.34,
            chargeOpacity: 0.38,
            flickerDuration: "1.16s",
        });
    }

    if (placement === 2) {
        return withMotionSettings({
            heat: 0.78,
            tight: 11,
            wide: 46,
            auraOpacity: 0.4,
            auraRestOpacity: 0.23,
            innerGlowOpacity: 0.28,
            chargeOpacity: 0.32,
            flickerDuration: "1.24s",
        });
    }

    if (placement === 3) {
        return withMotionSettings({
            heat: 0.58,
            tight: 10,
            wide: 38,
            auraOpacity: 0.36,
            auraRestOpacity: 0.21,
            innerGlowOpacity: 0.22,
            chargeOpacity: 0.26,
            flickerDuration: "1.32s",
        });
    }

    return withMotionSettings({
        heat,
        tight: 8 + heat * 10,
        wide: 22 + heat * 42,
        auraOpacity: 0.3 + heat * 0.24,
        auraRestOpacity: 0.18 + heat * 0.12,
        innerGlowOpacity: 0.08 + heat * 0.34,
        chargeOpacity: 0.06 + heat * 0.36,
        flickerDuration: `${1.62 - heat * 0.42}s`,
    });
}

function applyPlacementTheme(player) {
    const theme = getPlacementTheme(player.placement);

    $(".pr-scene").css({
        "--rank-accent": theme.accent,
        "--rank-accent-strong": theme.strong,
        "--rank-accent-dark": theme.dark,
        "--rank-accent-soft": theme.soft,
    });
}

function getThunderAudio() {
    if (!thunderAudio) {
        thunderAudio = new Audio(THUNDER_SFX);
        thunderAudio.preload = "auto";
        thunderAudio.volume = 0.9;
        thunderAudio.playbackRate = THUNDER_SFX_PLAYBACK_RATE;
    }

    return thunderAudio;
}

function playThunderSfx() {
    const audio = getThunderAudio();
    audio.pause();
    audio.currentTime = 0;
    audio.play().catch((error) => {
        console.warn("Could not play leaderboard thunder SFX.", error);
    });
}

function buildTeaserRankTransition() {
    const transition = $(`
        <div class="teaser-rank-transition" aria-hidden="true">
            <div class="teaser-rank-transition-clouds"></div>
            <div class="teaser-rank-transition-flash"></div>
            <div class="teaser-rank-transition-streak"></div>
            <div class="teaser-rank-transition-haze"></div>
        </div>
    `);
    $(".pr-scene").append(transition);
    return transition;
}

function renderRankBadge(player) {
    const glow = getRankGlowSettings(player.placement);
    const badge = $(".rank-badge");

    badge.html(`
        <div class="rank-number">#${player.placement}</div>
    `);

    badge.css({
        "--rank-heat": glow.heat,
        "--rank-glow-tight": `${glow.tight}px`,
        "--rank-glow-wide": `${glow.wide}px`,
        "--rank-glow-extra-wide": `${glow.extraWide}px`,
        "--rank-inner-glow-size": `${glow.innerGlowSize}px`,
        "--rank-aura-opacity": glow.auraOpacity,
        "--rank-aura-rest-opacity": glow.auraRestOpacity,
        "--rank-inner-glow-opacity": glow.innerGlowOpacity,
        "--rank-charge-opacity": glow.chargeOpacity,
        "--rank-flicker-duration": glow.flickerDuration,
        "--rank-flicker-low-brightness": glow.flickerLowBrightness,
        "--rank-flicker-peak-brightness": glow.flickerPeakBrightness,
        "--rank-flicker-settle-brightness": glow.flickerSettleBrightness,
        "--rank-flicker-late-brightness": glow.flickerLateBrightness,
        "--rank-flicker-low-saturation": glow.flickerLowSaturation,
        "--rank-flicker-peak-saturation": glow.flickerPeakSaturation,
        "--rank-flicker-settle-saturation": glow.flickerSettleSaturation,
        "--rank-flicker-late-saturation": glow.flickerLateSaturation,
        "--rank-aura-hot-scale": glow.auraHotScale,
    });
}

function renderPfp(player) {
    return `
        <div class="pfp-frame">
            <img class="pfp-image" src="${player.pfp || FALLBACK_PFP}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_PFP}';" />
        </div>
    `;
}

function renderTwitter(player) {
    const authorizations = _.get(player, "startgg.authorizations", []);
    const twitter = authorizations.find((auth) => auth && auth.type === "TWITTER" && auth.externalUsername);
    return twitter ? `<a href="${twitter.url || "#"}">@${_.escape(twitter.externalUsername)}</a>` : "";
}

function getCharacterGameCodename() {
    return config.character_game || _.get(data, "game.codename", "ssbu") || "ssbu";
}

function getPlayerMains(player) {
    const gameCodename = getCharacterGameCodename();
    const mains = _.get(player, `mains.${gameCodename}`, _.get(player, "mains.ssbu", []));
    return Array.isArray(mains) ? mains : [];
}

function assetValueForSkin(values, codename, skin) {
    const entries = _.get(values, codename, {});
    if (!entries || Object.keys(entries).length === 0) return undefined;
    return entries[String(skin)] || entries["0"] || Object.values(entries)[0];
}

function candidateSkinIds(assetConfig, codename, skin) {
    const ids = [skin];
    const mappedSkin = Number(_.get(assetConfig, `skin_mapping.${codename}.${skin}`));
    if (Number.isFinite(mappedSkin)) ids.push(mappedSkin);
    ids.push(0);
    return [...new Set(ids)];
}

async function assetExists(path) {
    const response = await fetch(path, { method: "HEAD", cache: "no-store" }).catch(() => null);
    return Boolean(response && response.ok);
}

async function findSkinFile(assetConfig, gameCodename, assetPack, codename, skin) {
    const prefix = assetConfig.prefix || "";
    const postfix = assetConfig.postfix || "";
    const baseName = `${prefix}${codename}${postfix}`;
    const extensions = [".png", ".webp", ".jpg", ".jpeg", ".webm"];

    for (const skinId of candidateSkinIds(assetConfig, codename, skin)) {
        const skinTexts = [`${skinId}`];
        if (skinId < 10) skinTexts.unshift(`0${skinId}`);

        for (const skinText of skinTexts) {
            for (const extension of extensions) {
                const file = `${baseName}${skinText}${extension}`;
                const path = `../../user_data/games/${gameCodename}/${assetPack}/${file}`;
                if (await assetExists(path)) return file;
            }
        }
    }

    return null;
}

async function buildRankedCharacterAsset(main, assetPackOverride = null) {
    if (!Array.isArray(main) || !main[0]) return null;

    const gameCodename = getCharacterGameCodename();
    const assetPack = assetPackOverride || config.character_asset_pack || "full";
    const skin = Number.isFinite(Number(main[1])) ? Number(main[1]) : 0;
    const gameConfig = await loadJsonCached(`../../user_data/games/${gameCodename}/base_files/config.json`);
    const assetConfig = await loadJsonCached(`../../user_data/games/${gameCodename}/${assetPack}/config.json`);
    const character = gameConfig.character_to_codename?.[main[0]];
    const codename = _.get(character, "codename");

    if (!codename) {
        console.warn(`No ${gameCodename} codename found for PR character "${main[0]}".`);
        return null;
    }

    const file = await findSkinFile(assetConfig, gameCodename, assetPack, codename, skin);

    if (!file) {
        console.warn(`No ${assetPack} asset found for PR character "${main[0]}" skin ${skin}.`);
        return null;
    }

    const asset = {
        type: assetConfig.type || [],
        asset: `./user_data/games/${gameCodename}/${assetPack}/${file}`,
        eyesight: assetValueForSkin(assetConfig.eyesights, codename, skin),
        image_size: assetValueForSkin(assetConfig.image_sizes, codename, skin),
        rescaling_factor: assetValueForSkin(assetConfig.rescaling_factor, codename, skin),
        unflippable: assetValueForSkin(assetConfig.unflippable, codename, skin),
        uncropped_edge: assetConfig.uncropped_edge,
        average_size: assetConfig.average_size,
    };

    return asset;
}

async function prepareRankedCharacter(player) {
    const token = ++characterRenderToken;
    const container = $(".pr-character");
    const mains = getPlayerMains(player);
    const main = mains[0];

    container.empty();
    container.removeData("preparedPlacement");

    const asset = await buildRankedCharacterAsset(main);
    if (!asset || token !== characterRenderToken) return null;

    const characterElement = $("<div class='tsh_character ranked-pr-character' style='opacity: 0;'><div></div></div>");
    container.append(characterElement);

    const options = {
        custom_zoom: 1,
        custom_center: [0.5, 0.52],
        scale_based_on_parent: true,
    };

    if (asset.asset.endsWith(".webm")) {
        await CenterVideo(characterElement.children(0), asset, options);
    } else {
        await CenterImage(characterElement.children(0), asset, options);
    }

    if (token !== characterRenderToken) return null;

    gsap.set(characterElement, {
        autoAlpha: 0,
        x: Number(window.PLAYER || 1) === 2 ? -90 : 90,
        scale: 1.04,
    });
    container.data("preparedPlacement", player.placement);

    return characterElement;
}

function getPreparedRankedCharacter(player) {
    const container = $(".pr-character");
    const characterElement = container.find(".ranked-pr-character");

    if (characterElement.length && Number(container.data("preparedPlacement")) === Number(player.placement)) {
        return characterElement;
    }

    return null;
}

function restartRankedCharacterMedia(characterElement) {
    if (!characterElement) return;

    $(characterElement)
        .find("video")
        .each((_, video) => {
            video.pause();
            video.currentTime = 0;
            video.play().catch((error) => {
                console.warn("Could not restart PR character video.", error);
            });
        });
}

async function prewarmOpeningPlayer() {
    const player = getCurrentPlayer();
    if (!player) return null;

    return prepareRankedCharacter(player).catch((error) => {
        console.warn("Could not prewarm opening PR character layer.", error);
        return null;
    });
}

function renderPlayerCard(player, direction = "in") {
    const twitter = renderTwitter(player);
    const pronoun = _.get(player, "startgg.genderPronoun") || "";
    const prefix = _.escape(getPlayerPrefix(player));
    const gamerTag = _.escape(getPlayerGamerTag(player));

    applyPlacementTheme(player);
    renderRankBadge(player);

    $(".rank-card").html(`
        <div class="rank-card-bg"></div>
        <div class="identity-column">
            ${renderPfp(player)}
            <div class="identity-copy">
                ${prefix ? `<div class="player-prefix">${prefix}</div>` : ""}
                <div class="player-tag"><div class="text">${gamerTag}</div></div>
                <div class="player-meta">
                    ${pronoun ? `<span>${pronoun}</span>` : ""}
                    ${twitter}
                </div>
            </div>
        </div>
    `);

    FitText($(".player-tag"));
}

async function buildRankedStockIcon(main) {
    if (!Array.isArray(main) || !main[0]) return null;

    const gameCodename = getCharacterGameCodename();
    const skin = Number.isFinite(Number(main[1])) ? Number(main[1]) : 0;
    const gameConfig = await loadJsonCached(`../../user_data/games/${gameCodename}/base_files/config.json`);
    const character = gameConfig.character_to_codename?.[main[0]];
    const codename = _.get(character, "codename");

    if (!codename) {
        console.warn(`No ${gameCodename} codename found for PR icon character "${main[0]}".`);
        return null;
    }

    const skinIds = [...new Set([skin, 0])];
    for (const skinId of skinIds) {
        const skinTexts = [`${skinId}`];
        if (skinId < 10) skinTexts.unshift(`0${skinId}`);

        for (const skinText of skinTexts) {
            const path = `../../user_data/games/${gameCodename}/base_files/icon/chara_2_${codename}_${skinText}.png`;
            if (await assetExists(path)) return path;
        }
    }

    console.warn(`No stock icon found for PR character "${main[0]}" skin ${skin}.`);
    return null;
}

async function renderLeaderboardKeyItem(player) {
    const mains = getPlayerMains(player);
    const icon = await buildRankedStockIcon(mains[0]);
    const rankText = `${player.placement}${getNumberOrdinal(player.placement)}`;
    const tag = _.escape(getPlayerGamerTag(player));
    const sponsor = _.escape(getPlayerSponsor(player));

    return `
        <article class="rank-key-item rank-${player.placement}">
            <div class="rank-key-icon-shell">
                ${
                    icon
                        ? `<img class="rank-key-icon" src="${icon}" alt="" />`
                        : `<div class="rank-key-icon-fallback"></div>`
                }
            </div>
            <div class="rank-key-copy">
                <div class="rank-key-mainline">
                    <span class="rank-key-rank">${rankText}</span>
                    <div class="rank-key-name-stack">
                        ${sponsor ? `<div class="rank-key-sponsor">${sponsor}</div>` : ""}
                        <span class="rank-key-tag"><span class="text">${tag}</span></span>
                    </div>
                </div>
            </div>
        </article>
    `;
}

async function renderLeaderboard() {
    const posterPlayers = rankedPlayers
        .filter((player) => player.placement <= 10)
        .sort((a, b) => a.placement - b.placement);
    const keyItems = await Promise.all(posterPlayers.map(renderLeaderboardKeyItem));

    $(".leaderboard-panel").html(`
        <section class="collage-stage">
            <img class="collage-image" src="${FINAL_COLLAGE_IMAGE}" alt="" />
        </section>
        <div class="collage-title">${FINAL_LEADERBOARD_TITLE}</div>
        <div class="leaderboard-reveal-overlay" aria-hidden="true">
            <div class="leaderboard-reveal-clouds"></div>
            <div class="leaderboard-reveal-bolt bolt-left"></div>
            <div class="leaderboard-reveal-bolt bolt-right"></div>
            <div class="leaderboard-reveal-flash"></div>
            <div class="leaderboard-reveal-sparks"></div>
            <div class="leaderboard-reveal-haze"></div>
        </div>
        <section class="rank-key">
            <div class="rank-key-items">
                ${keyItems.join("")}
            </div>
        </section>
    `);

    requestAnimationFrame(() => {
        $(".rank-key-tag").each((_, element) => FitText($(element)));
    });
}

function showStreamSafeError(message) {
    currentView = "error";
    stopTeaserLoading();
    gsap.set(".teaser-screen", { autoAlpha: 0, pointerEvents: "none" });
    $(".rank-card").html(`
        <div class="error-card">
            <div class="rank-eyebrow">PR Presentation</div>
            <div class="error-title">Ranking data unavailable</div>
            <div class="error-message">${message}</div>
        </div>
    `);
    gsap.set(".rank-card", { autoAlpha: 1 });
    gsap.set(".ranking-plate, .character-aura", { autoAlpha: 0 });
    gsap.set(".leaderboard-panel", { autoAlpha: 0, pointerEvents: "none" });
}

function setTeaserTip(text, animate = true) {
    const tip = $(".teaser-tip-text");
    if (!tip.length) return;

    if (!animate) {
        tip.text(text);
        return;
    }

    gsap.to(tip, {
        autoAlpha: 0,
        y: -8,
        duration: 0.22,
        ease: "power2.in",
        overwrite: true,
        onComplete: () => {
            tip.text(text);
            gsap.fromTo(
                tip,
                { autoAlpha: 0, y: 10 },
                { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out", overwrite: true },
            );
        },
    });
}

function cycleTeaserTip() {
    if (TEASER_LOADING_TIPS.length === 0) return;
    teaserTipIndex = (teaserTipIndex + 1) % TEASER_LOADING_TIPS.length;
    setTeaserTip(TEASER_LOADING_TIPS[teaserTipIndex]);
}

function runTeaserLoadingCycle() {
    const loadingFill = $(".teaser-loading-fill");
    if (!loadingFill.length) return;

    teaserLoadingTween = gsap.fromTo(
        loadingFill,
        { width: "0%" },
        {
            width: "100%",
            duration: TEASER_TIP_INTERVAL_MS / 1000,
            ease: "linear",
            overwrite: true,
            onComplete: () => {
                cycleTeaserTip();
                runTeaserLoadingCycle();
            },
        },
    );
}

function startTeaserLoading() {
    stopTeaserLoading();
    teaserTipIndex = 0;
    setTeaserTip(TEASER_LOADING_TIPS[teaserTipIndex] || "", false);
    runTeaserLoadingCycle();
}

function stopTeaserLoading() {
    if (teaserLoadingTween) {
        teaserLoadingTween.kill();
        teaserLoadingTween = null;
    }
}

async function showTeaser() {
    currentView = "teaser";
    characterRenderToken += 1;

    $(".rank-card, .rank-badge, .leaderboard-panel").empty();
    gsap.set(".ranking-plate, .character-aura, .rank-card, .rank-badge, .leaderboard-panel, .pr-character .tsh_character", {
        autoAlpha: 0,
        pointerEvents: "none",
        overwrite: true,
    });

    startTeaserLoading();

    const teaser = $(".teaser-screen");
    teaser.attr("aria-hidden", "false");
    await gsap
        .timeline()
        .set(teaser, { autoAlpha: 1, pointerEvents: "auto", overwrite: true }, 0)
        .fromTo(
            ".teaser-panel",
            { autoAlpha: 0, y: 34, scale: 0.985 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.66, ease: "expo.out", overwrite: true },
            0.05,
        )
        .fromTo(
            ".teaser-kicker, .teaser-title, .teaser-subtitle, .teaser-copy, .teaser-loading",
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.07, ease: "power2.out", overwrite: true },
            0.18,
        );
}

async function hideTeaser(dramatic = false) {
    stopTeaserLoading();
    const transition = dramatic ? buildTeaserRankTransition() : null;

    $(".teaser-screen").attr("aria-hidden", "true");

    if (dramatic) {
        transition.addClass("is-active");
        await gsap
            .timeline()
            .set(transition, { autoAlpha: 1, overwrite: true }, 0)
            .to(
                ".teaser-panel",
                {
                    autoAlpha: 0,
                    y: -38,
                    scale: 0.965,
                    duration: 0.46,
                    ease: "power3.inOut",
                    overwrite: true,
                },
                0,
            )
            .to(
                ".teaser-screen",
                {
                    autoAlpha: 0,
                    scale: 1.035,
                    duration: 0.72,
                    ease: "power2.inOut",
                    pointerEvents: "none",
                    overwrite: true,
                },
                0.08,
            );
    } else {
        await gsap.to(".teaser-screen", {
            autoAlpha: 0,
            scale: 1.012,
            duration: 0.34,
            ease: "power2.inOut",
            pointerEvents: "none",
            overwrite: true,
        });
    }

    gsap.set(".teaser-screen", { scale: 1 });
    return transition;
}

async function showPlayer(index, direction = "in") {
    const player = rankedPlayers[index];
    if (!player) return;

    currentView = "player";
    currentIndex = index;
    gsap.set(".leaderboard-panel", { autoAlpha: 0, pointerEvents: "none" });
    gsap.set(".rank-card, .rank-badge", { pointerEvents: "auto" });
    renderPlayerCard(player, direction);
    const isOpeningReveal = direction === "opening";

    if (isOpeningReveal && openingCharacterPreloadPromise) {
        await openingCharacterPreloadPromise;
        openingCharacterPreloadPromise = null;
    }

    const characterElement =
        getPreparedRankedCharacter(player) ||
        (await prepareRankedCharacter(player).catch((error) => {
            console.warn("Could not update PR ranked character layer.", error);
            return null;
        }));
    if (isOpeningReveal) restartRankedCharacterMedia(characterElement);

    gsap.set(".pfp-frame", { transformOrigin: "50% 50%" });

    const isRankAdvance = direction === "advance";
    const revealFromX = direction === "back" ? -80 : isOpeningReveal ? 126 : isRankAdvance ? 56 : 80;
    const badgeFromX = direction === "back" ? -54 : isOpeningReveal ? 86 : isRankAdvance ? 38 : 54;
    const baseCharacterFromX = isRankAdvance ? 68 : 90;
    const characterDirection = Number(window.PLAYER || 1) === 2 ? -1 : 1;
    const characterFromX = characterDirection * (isOpeningReveal ? 130 : baseCharacterFromX);
    const revealTimeline = gsap
        .timeline()
        .fromTo(
            ".ranking-plate",
            { autoAlpha: 0, x: revealFromX, y: isOpeningReveal ? 64 : isRankAdvance ? 24 : 36, scaleX: isOpeningReveal ? 0.985 : 1 },
            {
                autoAlpha: 1,
                x: 0,
                y: 0,
                scaleX: 1,
                duration: isOpeningReveal ? 0.78 : isRankAdvance ? 0.58 : 0.46,
                ease: "expo.out",
                overwrite: true,
            },
            isOpeningReveal ? 0.08 : isRankAdvance ? 0.03 : 0,
        )
        .fromTo(
            ".rank-card",
            { autoAlpha: 0, y: isOpeningReveal ? 46 : isRankAdvance ? 22 : 28, scale: isOpeningReveal ? 0.985 : isRankAdvance ? 0.99 : 1 },
            {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: isOpeningReveal ? 0.6 : isRankAdvance ? 0.5 : 0.42,
                ease: "expo.out",
                overwrite: true,
            },
            isOpeningReveal ? 0.32 : isRankAdvance ? 0.18 : 0.1,
        )
        .fromTo(
            ".pfp-frame",
            { scale: isOpeningReveal ? 0.76 : isRankAdvance ? 0.9 : 0.86 },
            { scale: 1, duration: isOpeningReveal ? 0.38 : isRankAdvance ? 0.32 : 0.24, ease: "back.out(1.45)", overwrite: true },
            isOpeningReveal ? 0.5 : isRankAdvance ? 0.26 : 0.18,
        )
        .fromTo(
            ".rank-badge",
            { autoAlpha: 0, x: badgeFromX, y: isOpeningReveal ? -22 : isRankAdvance ? -8 : 0, scale: isOpeningReveal ? 0.82 : isRankAdvance ? 0.9 : 0.92 },
            {
                autoAlpha: 1,
                x: 0,
                y: 0,
                scale: 1,
                duration: isOpeningReveal ? 0.64 : isRankAdvance ? 0.54 : 0.38,
                ease: "back.out(1.18)",
                overwrite: true,
            },
            isOpeningReveal ? 0.2 : isRankAdvance ? 0.08 : 0.05,
        )
        .fromTo(
            ".character-aura",
            { autoAlpha: 0, scale: isOpeningReveal ? 0.84 : isRankAdvance ? 0.9 : 0.92 },
            { autoAlpha: 1, scale: 1, duration: isOpeningReveal ? 0.72 : isRankAdvance ? 0.58 : 0.5, ease: "expo.out", overwrite: true },
            isOpeningReveal ? 0.18 : isRankAdvance ? 0.08 : 0.12,
        );

    if (characterElement) {
        revealTimeline.fromTo(
            characterElement || [],
            { autoAlpha: 0, x: characterFromX, scale: isOpeningReveal ? 1.09 : isRankAdvance ? 1.035 : 1.04 },
            { autoAlpha: 1, x: 0, scale: 1, duration: isOpeningReveal ? 0.86 : isRankAdvance ? 0.72 : 0.65, ease: "expo.out", overwrite: true },
            isOpeningReveal ? 0.16 : isRankAdvance ? 0.06 : 0.08,
        );
    }

    await revealTimeline;
}

async function showLeaderboard() {
    currentView = "leaderboard";
    characterRenderToken += 1;
    const blackout = $("<div class='leaderboard-scene-blackout'></div>");
    $(".pr-scene").append(blackout);

    await gsap
        .timeline()
        .to(blackout, { autoAlpha: 1, duration: 0.34, ease: "power2.inOut" }, 0)
        .to(
            ".ranking-plate, .character-aura, .rank-card, .rank-badge, .pr-character .tsh_character",
            {
                autoAlpha: 0,
                x: -80,
                duration: 0.34,
                ease: "power2.inOut",
                overwrite: true,
            },
            0,
        );

    await renderLeaderboard();
    const leaderboard = $(".leaderboard-panel");

    leaderboard.removeClass("is-revealing");
    gsap.set(leaderboard, { autoAlpha: 1, y: 0, scale: 1, pointerEvents: "auto", overwrite: true });
    void leaderboard[0]?.offsetWidth;
    leaderboard.addClass("is-revealing");
    window.setTimeout(playThunderSfx, LEADERBOARD_FLASH_SFX_DELAY_MS);
    gsap.to(blackout, {
        autoAlpha: 0,
        duration: 0.74,
        delay: 0.12,
        ease: "power2.inOut",
        onComplete: () => blackout.remove(),
    });
    window.setTimeout(() => leaderboard.removeClass("is-revealing"), 2400);
}

async function advancePresentation() {
    if (transitionLocked || currentView === "error") return;
    transitionLocked = true;
    document.body.dataset.transitioning = "true";

    if (currentView === "teaser") {
        const teaserTransition = await hideTeaser(true);
        await showPlayer(currentIndex, "opening");
        if (teaserTransition) {
            gsap.to(teaserTransition, {
                autoAlpha: 0,
                duration: 0.44,
                ease: "power2.out",
                overwrite: true,
                onComplete: () => teaserTransition.remove(),
            });
        }
        transitionLocked = false;
        document.body.dataset.transitioning = "false";
        return;
    }

    if (currentView === "leaderboard") {
        transitionLocked = false;
        document.body.dataset.transitioning = "false";
        return;
    }

    const nextIndex = currentIndex - 1;
    if (nextIndex >= 0) {
        await gsap
            .timeline()
            .to(
                ".rank-card",
                {
                    autoAlpha: 0,
                    y: 18,
                    scale: 0.985,
                    duration: 0.34,
                    ease: "power2.inOut",
                    overwrite: true,
                },
                0,
            )
            .to(
                ".rank-badge",
                {
                    autoAlpha: 0,
                    x: -38,
                    y: 10,
                    scale: 0.94,
                    duration: 0.36,
                    ease: "power2.inOut",
                    overwrite: true,
                },
                0.02,
            )
            .to(
                ".pr-character .tsh_character",
                {
                    autoAlpha: 0,
                    x: -54,
                    scale: 0.985,
                    duration: 0.42,
                    ease: "power2.inOut",
                    overwrite: true,
                },
                0.03,
            )
            .to(
                ".character-aura",
                {
                    autoAlpha: 0,
                    scale: 0.94,
                    duration: 0.38,
                    ease: "power2.inOut",
                    overwrite: true,
                },
                0.04,
            )
            .to(
                ".ranking-plate",
                {
                    autoAlpha: 0,
                    x: -46,
                    y: 12,
                    scaleX: 0.99,
                    duration: 0.4,
                    ease: "power2.inOut",
                    overwrite: true,
                },
                0.06,
            );
        await showPlayer(nextIndex, "advance");
    } else {
        await showLeaderboard();
    }

    transitionLocked = false;
    document.body.dataset.transitioning = "false";
}

LoadEverything().then(async () => {
    assignDefault(config, tsh_settings || {});
    assignDefault(config, window.config || {});

    if (!window.PLAYER) window.PLAYER = 1;
    document.body.classList.add(Number(window.PLAYER) === 2 ? "side-p2" : "side-p1");
    getThunderAudio().load();

    Start = async () => {
        try {
            const rankingData = await loadRankingJson(config.ranking_json || DEFAULT_RANKING_JSON);
            rankedPlayers = sanitizeRankedPlayers(rankingData);

            if (rankedPlayers.length === 0) {
                showStreamSafeError("No ranked players with both placement and tag were found.");
                return;
            }

            currentIndex = getStartingIndex(rankedPlayers);
            await showTeaser();
            openingCharacterPreloadPromise = prewarmOpeningPlayer();
            transitionLocked = false;
            document.body.dataset.transitioning = "false";
        } catch (error) {
            console.error(error);
            showStreamSafeError("Check player_placements_startgg.json and reload the browser source.");
        }
    };

    Update = async () => {};

    window.addEventListener("click", advancePresentation);
    window.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
            advancePresentation();
        }
    });
});
