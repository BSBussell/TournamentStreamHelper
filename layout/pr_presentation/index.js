const DEFAULT_RANKING_JSON = "./player_placements_startgg.json";
const FALLBACK_PFP = "./person.svg";
const FINAL_LEADERBOARD_TITLE_LINES = ["East TN PR", "Spring 2026"];
const FINAL_REVEAL_SFX = "./sfx/magicThud.mp3";
const FINAL_REVEAL_SFX_PLAYBACK_RATE = 1;
const FINAL_REVEAL_SFX_DELAY_MS = 520;
const TEASER_COUNTDOWN_TARGET_HOUR = 18;
const TEASER_COUNTDOWN_TARGET_MINUTE = 10;

let rankedPlayers = [];
let currentIndex = 0;
let startingIndex = 0;
let currentView = "teaser";
let transitionLocked = true;
let characterRenderToken = 0;
let teaserCountdownTimer = null;
let teaserCountdownTarget = null;
let teaserRegionMapShown = false;
let teaserRegionMapTransitioning = false;
let teaserRegionMapPrepared = false;
let finalRevealAudio = null;
let openingCharacterPreloadPromise = null;
const jsonCache = {};

let config = {
    ranking_json: DEFAULT_RANKING_JSON,
    start_placement: 10,
    character_asset_pack: "webm",
    character_game: "ssbu",
    location_mode: "off",
};

const LOCATION_MODES_WITH_REGION_COLOR = new Set(["region_color", "map_prelude"]);
const LOCATION_PRELUDE_REGIONS = {
    "tri-cities": {
        label: "Tri-Cities",
        x: "82.8%",
        y: "22.5%",
    },
    knoxville: {
        label: "Knoxville",
        x: "65.8%",
        y: "43.5%",
    },
    chattanooga: {
        label: "Chattanooga",
        x: "55.0%",
        y: "82.5%",
    },
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

function normalizeLocationRegion(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-");
}

function getPlayerLocationRegion(player) {
    const rawLocation = player.location || player.area || _.get(player, "startgg.location.city") || "";
    const normalized = normalizeLocationRegion(rawLocation);

    if (normalized.includes("tri-cities") || normalized.includes("tricities") || normalized.includes("tricot")) {
        return "tri-cities";
    }

    if (normalized.includes("knoxville")) {
        return "knoxville";
    }

    if (normalized.includes("chattanooga")) {
        return "chattanooga";
    }

    return "";
}

function getPlayerLocationLabel(player) {
    const region = getPlayerLocationRegion(player);
    const labels = Object.fromEntries(Object.entries(LOCATION_PRELUDE_REGIONS).map(([key, value]) => [key, value.label]));

    return labels[region] || "";
}

function getLocationMode() {
    return config.location_mode || config.locationMode || "off";
}

function locationRegionColorEnabled() {
    return LOCATION_MODES_WITH_REGION_COLOR.has(getLocationMode());
}

function locationMapPreludeEnabled() {
    return getLocationMode() === "map_prelude";
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
    const fromCss = (suffix, fallback) => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(suffix).trim();
        return raw || fallback;
    };

    if (placement <= 1) {
        return {
            accent: fromCss("--rank-accent-place-1", "#f6a900"),
            strong: fromCss("--rank-accent-strong-place-1", "#ffe78a"),
            dark: fromCss("--rank-accent-dark-place-1", "#8a4d00"),
            soft: fromCss("--rank-accent-soft-place-1", "rgba(255, 184, 28, 0.22)"),
        };
    }

    if (placement === 2) {
        return {
            accent: fromCss("--rank-accent-place-2", "#b8cfe8"),
            strong: fromCss("--rank-accent-strong-place-2", "#edf7ff"),
            dark: fromCss("--rank-accent-dark-place-2", "#4a6075"),
            soft: fromCss("--rank-accent-soft-place-2", "rgba(154, 193, 230, 0.18)"),
        };
    }

    if (placement === 3) {
        return {
            accent: fromCss("--rank-accent-place-3", "#c87532"),
            strong: fromCss("--rank-accent-strong-place-3", "#ffd09a"),
            dark: fromCss("--rank-accent-dark-place-3", "#6d2f10"),
            soft: fromCss("--rank-accent-soft-place-3", "rgba(210, 112, 42, 0.3)"),
        };
    }

    if (placement <= 6) {
        return {
            accent: fromCss("--rank-accent-place-6", "#ff9d1b"),
            strong: fromCss("--rank-accent-strong-place-6", "#ffe06a"),
            dark: fromCss("--rank-accent-dark-place-6", "#9b3900"),
            soft: fromCss("--rank-accent-soft-place-6", "rgba(255, 150, 24, 0.3)"),
        };
    }

    return {
        accent: fromCss("--rank-accent", "#ff7418"),
        strong: fromCss("--rank-accent-strong", "#ffc247"),
        dark: fromCss("--rank-accent-dark", "#8f2500"),
        soft: fromCss("--rank-accent-soft", "rgba(255, 103, 16, 0.28)"),
    };
}

function getThemeCollageImage() {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--pr-collage-image").trim();
    if (!value) return "./collage/characters-wreath.png";
    return value.replace(/^['"]|['"]$/g, "");
}

function getRankGlowSettings(placement) {
    const heat = getPlacementHeat(placement);
    const withMotionSettings = (settings) => ({
        ...settings,
        extraWide: settings.wide * 1.18,
        innerGlowSize: Math.max(3, settings.tight * 0.42),
        baseRimOpacity: settings.baseRimOpacity ?? 0.74,
        glowTightMix: settings.glowTightMix ?? "62%",
        glowWideMix: settings.glowWideMix ?? "48%",
        glowExtraWideMix: settings.glowExtraWideMix ?? "24%",
        hardShadowMix: settings.hardShadowMix ?? "100%",
        flickerLowBrightness: 1 + settings.heat * 0.07,
        flickerPeakBrightness: 1 + settings.heat * 0.16,
        flickerSettleBrightness: 1 + settings.heat * 0.09,
        flickerLateBrightness: 1 + settings.heat * 0.13,
        flickerLowSaturation: 1 + settings.heat * 0.05,
        flickerPeakSaturation: 1 + settings.heat * 0.11,
        flickerSettleSaturation: 1 + settings.heat * 0.07,
        flickerLateSaturation: 1 + settings.heat * 0.09,
        auraHotScale: 1.02 + settings.heat * 0.055,
    });

    if (placement >= 10) {
        return withMotionSettings({
            heat: 0.08,
            tight: 7,
            wide: 16,
            auraOpacity: 0.2,
            auraRestOpacity: 0.1,
            innerGlowOpacity: 0.12,
            chargeOpacity: 0.22,
            baseRimOpacity: 0.46,
            glowTightMix: "28%",
            glowWideMix: "22%",
            glowExtraWideMix: "12%",
            hardShadowMix: "88%",
            flickerDuration: "1.62s",
        });
    }

    if (placement <= 1) {
        return withMotionSettings({
            heat: 1,
            tight: 22,
            wide: 86,
            auraOpacity: 0.68,
            auraRestOpacity: 0.34,
            innerGlowOpacity: 0.64,
            chargeOpacity: 0.58,
            glowTightMix: "78%",
            glowWideMix: "64%",
            glowExtraWideMix: "34%",
            flickerDuration: "1.04s",
        });
    }

    if (placement === 2) {
        return withMotionSettings({
            heat: 0.78,
            tight: 18,
            wide: 68,
            auraOpacity: 0.56,
            auraRestOpacity: 0.3,
            innerGlowOpacity: 0.5,
            chargeOpacity: 0.46,
            glowTightMix: "70%",
            glowWideMix: "56%",
            glowExtraWideMix: "30%",
            flickerDuration: "1.14s",
        });
    }

    if (placement === 3) {
        return withMotionSettings({
            heat: 0.58,
            tight: 15,
            wide: 54,
            auraOpacity: 0.48,
            auraRestOpacity: 0.27,
            innerGlowOpacity: 0.4,
            chargeOpacity: 0.38,
            glowTightMix: "66%",
            glowWideMix: "52%",
            glowExtraWideMix: "27%",
            flickerDuration: "1.24s",
        });
    }

    return withMotionSettings({
        heat,
        tight: 10 + heat * 16,
        wide: 26 + heat * 58,
        auraOpacity: 0.32 + heat * 0.34,
        auraRestOpacity: 0.2 + heat * 0.16,
        innerGlowOpacity: 0.12 + heat * 0.5,
        chargeOpacity: 0.08 + heat * 0.48,
        flickerDuration: `${1.62 - heat * 0.5}s`,
    });
}

function applyPlacementTheme(player, animate = false) {
    const theme = getPlacementTheme(player.placement);
    const target = ".pr-scene";
    const variables = {
        "--rank-accent": theme.accent,
        "--rank-accent-strong": theme.strong,
        "--rank-accent-dark": theme.dark,
        "--rank-accent-soft": theme.soft,
    };

    if (animate) {
        gsap.to(target, {
            ...variables,
            duration: 0.58,
            ease: "power2.inOut",
            overwrite: "auto",
        });
        return;
    }

    gsap.set(target, variables);
}

function getCssVariable(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function applyLocationPlateTheme(player, animate = false) {
    const scene = document.querySelector(".pr-scene");
    if (!scene) return;

    if (!locationRegionColorEnabled()) {
        scene.classList.remove("location-mode-region-color");
        scene.style.removeProperty("--pr-active-ranking-plate-bg");
        scene.style.removeProperty("--pr-location-plate-start");
        scene.style.removeProperty("--pr-location-plate-mid");
        scene.style.removeProperty("--pr-location-plate-end");
        return;
    }

    const region = getPlayerLocationRegion(player);
    const variablesByRegion = {
        "tri-cities": {
            start: "--pr-location-plate-tri-cities-start",
            mid: "--pr-location-plate-tri-cities-mid",
            end: "--pr-location-plate-tri-cities-end",
        },
        knoxville: {
            start: "--pr-location-plate-knoxville-start",
            mid: "--pr-location-plate-knoxville-mid",
            end: "--pr-location-plate-knoxville-end",
        },
        chattanooga: {
            start: "--pr-location-plate-chattanooga-start",
            mid: "--pr-location-plate-chattanooga-mid",
            end: "--pr-location-plate-chattanooga-end",
        },
    };
    const regionVariables = variablesByRegion[region];

    if (!regionVariables) {
        scene.classList.remove("location-mode-region-color");
        scene.style.removeProperty("--pr-active-ranking-plate-bg");
        scene.style.removeProperty("--pr-location-plate-start");
        scene.style.removeProperty("--pr-location-plate-mid");
        scene.style.removeProperty("--pr-location-plate-end");
        return;
    }

    scene.classList.add("location-mode-region-color");
    scene.style.removeProperty("--pr-active-ranking-plate-bg");

    const variables = {
        "--pr-location-plate-start": getCssVariable(regionVariables.start),
        "--pr-location-plate-mid": getCssVariable(regionVariables.mid),
        "--pr-location-plate-end": getCssVariable(regionVariables.end),
    };

    if (animate) {
        gsap.to(scene, {
            ...variables,
            duration: 0.58,
            ease: "power2.inOut",
            overwrite: "auto",
        });
        return;
    }

    gsap.set(scene, variables);
}

function getFinalRevealAudio() {
    if (!finalRevealAudio) {
        finalRevealAudio = new Audio(FINAL_REVEAL_SFX);
        finalRevealAudio.preload = "auto";
        finalRevealAudio.volume = 0.92;
        finalRevealAudio.playbackRate = FINAL_REVEAL_SFX_PLAYBACK_RATE;
    }

    return finalRevealAudio;
}

function playFinalRevealSfx() {
    const audio = getFinalRevealAudio();
    audio.pause();
    audio.currentTime = 0;
    audio.playbackRate = FINAL_REVEAL_SFX_PLAYBACK_RATE;
    audio.play().catch((error) => {
        console.warn("Could not play leaderboard reveal SFX.", error);
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
        <div class="rank-number"><span class="rank-number-hash">#</span><span class="rank-number-value">${player.placement}</span></div>
    `);

    badge.css({
        "--rank-heat": glow.heat,
        "--rank-glow-tight": `${glow.tight}px`,
        "--rank-glow-wide": `${glow.wide}px`,
        "--rank-glow-extra-wide": `${glow.extraWide}px`,
        "--rank-inner-glow-size": `${glow.innerGlowSize}px`,
        "--rank-base-rim-opacity": glow.baseRimOpacity,
        "--rank-glow-tight-mix": glow.glowTightMix,
        "--rank-glow-wide-mix": glow.glowWideMix,
        "--rank-glow-extra-wide-mix": glow.glowExtraWideMix,
        "--rank-hard-shadow-mix": glow.hardShadowMix,
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
    const locationLabel = _.escape(getPlayerLocationLabel(player));
    const showLocation = getLocationMode() !== "off" && locationLabel;
    const shouldAnimateTheme = direction === "advance" || direction === "back";

    applyPlacementTheme(player, shouldAnimateTheme);
    applyLocationPlateTheme(player, shouldAnimateTheme);
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
                    ${showLocation ? `<span class="player-location">${locationLabel}</span>` : ""}
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
    const rankText = `${player.placement}`;
    const tag = _.escape(getPlayerGamerTag(player));
    const locationLabel = _.escape(getPlayerLocationLabel(player));
    const locationRegion = getPlayerLocationRegion(player);
    const mains = getPlayerMains(player);
    const icon = await buildRankedStockIcon(mains[0]);

    return `
        <article class="rank-key-item rank-${player.placement}">
            <span class="rank-key-rank">${rankText}</span>
            <span class="rank-key-icon-shell">
                ${
                    icon
                        ? `<img class="rank-key-icon" src="${icon}" alt="" />`
                        : `<span class="rank-key-icon-fallback"></span>`
                }
            </span>
            <span class="rank-key-copy">
                <span class="rank-key-tag"><span class="text">${tag}</span></span>
                ${locationLabel ? `<span class="rank-key-location rank-key-location-${locationRegion}">${locationLabel}</span>` : ""}
            </span>
        </article>
    `;
}

async function buildLocationPreludeIcon(player) {
    const mains = getPlayerMains(player);
    const icon = await buildRankedStockIcon(mains[0]).catch((error) => {
        console.warn("Could not build PR location prelude icon.", error);
        return null;
    });

    return icon || player.pfp || FALLBACK_PFP;
}

async function showLocationMapPrelude(player, direction = "advance") {
    if (!locationMapPreludeEnabled()) return;

    const region = getPlayerLocationRegion(player);
    const regionConfig = LOCATION_PRELUDE_REGIONS[region];
    if (!regionConfig) return;

    const icon = _.escape(await buildLocationPreludeIcon(player));
    const label = _.escape(regionConfig.label);
    const rankText = `#${player.placement}`;
    const prelude = $(`
        <section class="location-prelude location-prelude-${region}" style="--location-pin-x: ${regionConfig.x}; --location-pin-y: ${regionConfig.y};" aria-hidden="true">
            <div class="location-prelude-glow"></div>
            <div class="location-map-shell">
                <div class="location-map-art">
                    <div class="location-map-orbits"></div>
                    <div class="location-map-outline"></div>
                    <div class="location-map-nebula"></div>
                    <div class="location-map-stars"></div>
                    <div class="location-map-border"></div>
                    <div class="location-map-pin" style="--location-pin-x: ${regionConfig.x}; --location-pin-y: ${regionConfig.y};">
                        <span class="location-map-pulse pulse-one"></span>
                        <span class="location-map-pulse pulse-two"></span>
                        <span class="location-map-icon-shell">
                            <img class="location-map-icon" src="${icon}" alt="" />
                        </span>
                    </div>
                </div>
            </div>
            <div class="location-prelude-copy">
                <div class="location-prelude-kicker">${rankText} Hailing from:</div>
                <div class="location-prelude-region">${label}</div>
            </div>
        </section>
    `);

    $(".pr-scene").append(prelude);
    applyLocationPlateTheme(player, true);

    const travelX = direction === "back" ? -36 : 36;
    await gsap
        .timeline()
        .set(prelude, { autoAlpha: 1, pointerEvents: "none", overwrite: true }, 0)
        .fromTo(prelude, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: "power2.out" }, 0)
        .fromTo(
            prelude.find(".location-map-shell"),
            { autoAlpha: 0, x: travelX, scale: 0.965 },
            { autoAlpha: 1, x: 0, scale: 1, duration: 0.42, ease: "expo.out" },
            0.04,
        )
        .fromTo(
            prelude.find(".location-map-orbits, .location-map-outline, .location-map-nebula, .location-map-stars, .location-map-border"),
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.32, stagger: 0.04, ease: "power2.out" },
            0.12,
        )
        .fromTo(
            prelude.find(".location-map-pin"),
            { autoAlpha: 0, scale: 0.22, filter: "blur(12px) brightness(1.8)" },
            { autoAlpha: 1, scale: 1, filter: "blur(0px) brightness(1)", duration: 0.54, ease: "expo.out" },
            1.08,
        )
        .fromTo(
            prelude.find(".location-map-pulse"),
            { autoAlpha: 0, scale: 0.35 },
            { autoAlpha: 1, scale: 1, duration: 0.34, stagger: 0.12, ease: "power2.out" },
            1.02,
        )
        .fromTo(
            prelude.find(".location-prelude-kicker, .location-prelude-region"),
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.06, ease: "power2.out" },
            0.42,
        )
        .to(prelude, { autoAlpha: 0, scale: 1.025, duration: 0.48, ease: "power2.inOut" }, 4.15);

    prelude.remove();
}

async function renderLeaderboard() {
    const posterPlayers = rankedPlayers
        .filter((player) => player.placement <= 10)
        .sort((a, b) => a.placement - b.placement);
    const keyItems = await Promise.all(posterPlayers.map(renderLeaderboardKeyItem));

    $(".leaderboard-panel").html(`
        <div class="leaderboard-final-title">
            <span class="leaderboard-final-title-primary">${FINAL_LEADERBOARD_TITLE_LINES[0]}</span>
            <span class="leaderboard-final-title-secondary">${FINAL_LEADERBOARD_TITLE_LINES[1]}</span>
        </div>
        <section class="rank-key" aria-label="Top 10 rankings">
            <div class="rank-key-items">
                ${keyItems.join("")}
            </div>
        </section>
        <section class="collage-stage">
            <img class="collage-image" src="${getThemeCollageImage()}" alt="" />
        </section>
        <div class="leaderboard-reveal-overlay" aria-hidden="true">
            <div class="leaderboard-reveal-clouds"></div>
            
            <div class="leaderboard-reveal-flash"></div>
            <div class="leaderboard-reveal-sparks"></div>
            <div class="leaderboard-reveal-haze"></div>
        </div>
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

function getNextTeaserCountdownTarget(now = new Date()) {
    const target = new Date(now);
    target.setHours(TEASER_COUNTDOWN_TARGET_HOUR, TEASER_COUNTDOWN_TARGET_MINUTE, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    return target;
}

function formatTeaserCountdown(msRemaining) {
    const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateTeaserCountdown() {
    const value = $(".teaser-countdown-value");
    if (!value.length) return;

    const now = new Date();
    if (!teaserCountdownTarget) {
        teaserCountdownTarget = getNextTeaserCountdownTarget(now);
    }

    const msRemaining = teaserCountdownTarget.getTime() - now.getTime();
    value.text(formatTeaserCountdown(msRemaining));

    if (msRemaining <= 0) {
        void showTeaserRegionMap();
    }
}

function startTeaserLoading() {
    stopTeaserLoading();
    teaserCountdownTarget = getNextTeaserCountdownTarget(new Date());
    updateTeaserCountdown();
    teaserCountdownTimer = window.setInterval(updateTeaserCountdown, 1000);
}

function stopTeaserLoading() {
    if (teaserCountdownTimer) {
        window.clearInterval(teaserCountdownTimer);
        teaserCountdownTimer = null;
    }
}

function renderTeaserRegionMap() {
    const nodes = Object.entries(LOCATION_PRELUDE_REGIONS)
        .map(
            ([region, config]) => `
                <div class="teaser-region-node teaser-region-node-${region}" style="--location-pin-x: ${config.x}; --location-pin-y: ${config.y};">
                    <span class="teaser-region-node-pulse"></span>
                    <span class="teaser-region-node-core"></span>
                </div>
            `,
        )
        .join("");

    return `
        <section class="teaser-region-map" aria-label="East Tennessee PR sub-regions">
            <div class="location-map-shell">
                <div class="location-map-art">
                    <div class="location-map-orbits"></div>
                    <div class="location-map-outline"></div>
                    <div class="location-map-nebula"></div>
                    <div class="location-map-stars"></div>
                    <div class="location-map-border"></div>
                    ${nodes}
                </div>
            </div>
        </section>
    `;
}

function prepareTeaserRegionMap() {
    const teaser = $(".teaser-screen");
    if (!teaser.length) return;

    if (!$(".teaser-region-map").length) {
        teaser.append(renderTeaserRegionMap());
    }

    const map = $(".teaser-region-map");
    gsap.set(map, {
        autoAlpha: 0,
        scale: 0.94,
        force3D: true,
        pointerEvents: "none",
        overwrite: true,
    });
    gsap.set(".teaser-region-map .location-map-shell, .teaser-region-map .location-map-art, .teaser-region-node", {
        force3D: true,
        overwrite: true,
    });

    // Force the SVG mask and map layers to rasterize before the reveal click/countdown edge.
    void map[0]?.offsetWidth;
    teaserRegionMapPrepared = true;
}

async function showTeaserRegionMap() {
    if (teaserRegionMapShown || teaserRegionMapTransitioning) return;

    const teaser = $(".teaser-screen");
    if (!teaser.length) return;

    teaserRegionMapTransitioning = true;
    stopTeaserLoading();

    if (!teaserRegionMapPrepared || !$(".teaser-region-map").length) prepareTeaserRegionMap();

    await gsap
        .timeline()
        .to(".teaser-panel > :not(.teaser-region-map)", {
            autoAlpha: 0,
            y: -12,
            duration: 0.42,
            ease: "power2.inOut",
            pointerEvents: "none",
            overwrite: true,
        }, 0)
        .fromTo(
            ".teaser-region-map",
            { autoAlpha: 0, scale: 0.94 },
            { autoAlpha: 1, scale: 1, duration: 0.74, ease: "expo.out", force3D: true, overwrite: true },
            0.22,
        )
        .fromTo(
            ".teaser-region-map .location-map-orbits, .teaser-region-map .location-map-outline, .teaser-region-map .location-map-nebula, .teaser-region-map .location-map-stars, .teaser-region-map .location-map-border",
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.46, stagger: 0.05, ease: "power2.out", overwrite: true },
            0.34,
        )
        .fromTo(
            ".teaser-region-node",
            { autoAlpha: 0, scale: 0.35 },
            { autoAlpha: 1, scale: 1, duration: 0.36, stagger: 0.1, ease: "back.out(1.4)", force3D: true, overwrite: true },
            0.86,
        );

    teaserRegionMapShown = true;
    teaserRegionMapTransitioning = false;
}

async function showTeaser() {
    currentView = "teaser";
    characterRenderToken += 1;
    teaserRegionMapShown = false;
    teaserRegionMapTransitioning = false;
    teaserRegionMapPrepared = false;

    $(".rank-card, .rank-badge, .leaderboard-panel").empty();
    gsap.set(".ranking-plate, .character-aura, .rank-card, .rank-badge, .leaderboard-panel, .pr-character .tsh_character", {
        autoAlpha: 0,
        pointerEvents: "none",
        overwrite: true,
    });

    startTeaserLoading();

    const teaser = $(".teaser-screen");
    teaser.attr("aria-hidden", "false");
    prepareTeaserRegionMap();
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
            ".teaser-kicker, .teaser-title, .teaser-subtitle, .teaser-copy, .teaser-countdown",
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
    const isRankBack = direction === "back";
    const revealFromX = isRankBack ? -80 : isOpeningReveal ? 126 : isRankAdvance ? 56 : 80;
    const badgeFromX = isRankBack ? -54 : isOpeningReveal ? 86 : isRankAdvance ? 38 : 54;
    const baseCharacterFromX = isRankBack ? -78 : isRankAdvance ? 68 : 90;
    const characterDirection = Number(window.PLAYER || 1) === 2 ? -1 : 1;
    const characterFromX = characterDirection * (isOpeningReveal ? 130 : baseCharacterFromX);

    if (isRankAdvance) {
        gsap.set(".ranking-plate", { autoAlpha: 1, x: 0, y: 0, scaleX: 1, overwrite: true });
    }

    if (isRankBack) {
        gsap.set(".ranking-plate", { autoAlpha: 1, x: 0, y: 0, scaleX: 1, overwrite: true });
    }

    const revealTimeline = gsap.timeline();

    if (!isRankAdvance && !isRankBack) {
        revealTimeline.fromTo(
            ".ranking-plate",
            { autoAlpha: 0, x: revealFromX, y: isOpeningReveal ? 64 : isRankAdvance ? 24 : isRankBack ? 36 : 36, scaleX: isOpeningReveal ? 0.985 : 1 },
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
        );
    }

    revealTimeline
        .to(
            ".ranking-plate",
            {
                "--plate-raised-edge": "0%",
                duration: isRankAdvance || isRankBack ? 0.58 : 0.01,
                ease: "power3.out",
                overwrite: "auto",
            },
            0,
        )
        .fromTo(
            ".rank-card",
            {
                autoAlpha: 0,
                x: isRankAdvance ? 72 : isRankBack ? -72 : 0,
                y: isOpeningReveal ? 46 : isRankAdvance || isRankBack ? 4 : 28,
                scale: isOpeningReveal ? 0.985 : isRankAdvance || isRankBack ? 0.995 : 1,
            },
            {
                autoAlpha: 1,
                x: 0,
                y: 0,
                scale: 1,
                duration: isOpeningReveal ? 0.6 : isRankAdvance || isRankBack ? 0.52 : 0.42,
                ease: isRankAdvance || isRankBack ? "power3.out" : "expo.out",
                overwrite: true,
            },
            isOpeningReveal ? 0.32 : isRankAdvance || isRankBack ? 0.08 : 0.1,
        )
        .fromTo(
            ".pfp-frame",
            { scale: isOpeningReveal ? 0.76 : isRankAdvance ? 0.9 : 0.86 },
            { scale: 1, duration: isOpeningReveal ? 0.38 : isRankAdvance ? 0.32 : 0.24, ease: "back.out(1.45)", overwrite: true },
            isOpeningReveal ? 0.5 : isRankAdvance ? 0.26 : 0.18,
        )
        .fromTo(
            ".rank-badge",
            { autoAlpha: 0, x: isRankAdvance ? 62 : isRankBack ? -62 : badgeFromX, y: isOpeningReveal ? -22 : 0, scale: isOpeningReveal ? 0.82 : isRankAdvance || isRankBack ? 0.94 : 0.92 },
            {
                autoAlpha: 1,
                x: 0,
                y: 0,
                scale: 1,
                duration: isOpeningReveal ? 0.64 : isRankAdvance || isRankBack ? 0.54 : 0.38,
                ease: isRankAdvance || isRankBack ? "power3.out" : "back.out(1.18)",
                overwrite: true,
            },
            isOpeningReveal ? 0.2 : isRankAdvance || isRankBack ? 0.02 : 0.05,
        )
        .fromTo(
            ".character-aura",
            { autoAlpha: 0, x: isRankAdvance ? 48 : isRankBack ? -48 : 0, scale: isOpeningReveal ? 0.84 : isRankAdvance || isRankBack ? 0.96 : 0.92 },
            { autoAlpha: 1, x: 0, scale: 1, duration: isOpeningReveal ? 0.72 : isRankAdvance || isRankBack ? 0.58 : 0.5, ease: "expo.out", overwrite: true },
            isOpeningReveal ? 0.18 : isRankAdvance || isRankBack ? 0.08 : 0.12,
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
    gsap.set(leaderboard, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        pointerEvents: "auto",
        overwrite: true,
    });
    void leaderboard[0]?.offsetWidth;
    leaderboard.addClass("is-revealing");
    window.setTimeout(playFinalRevealSfx, FINAL_REVEAL_SFX_DELAY_MS);
    gsap.to(blackout, {
        autoAlpha: 0,
        duration: 0.74,
        delay: 0.12,
        ease: "power2.inOut",
        onComplete: () => blackout.remove(),
    });
    window.setTimeout(() => leaderboard.removeClass("is-revealing"), 2400);
}

async function showLeaderboardInstant() {
    currentView = "leaderboard";
    characterRenderToken += 1;
    stopTeaserLoading();

    gsap.set(".teaser-screen, .ranking-plate, .character-aura, .rank-card, .rank-badge, .pr-character .tsh_character", {
        autoAlpha: 0,
        pointerEvents: "none",
        overwrite: true,
    });

    await renderLeaderboard();
    gsap.set(".leaderboard-panel", {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        pointerEvents: "auto",
        overwrite: true,
    });
}

async function advancePresentation() {
    if (transitionLocked || currentView === "error") return;
    transitionLocked = true;
    document.body.dataset.transitioning = "true";

    if (currentView === "teaser") {
        const teaserTransition = await hideTeaser(true);
        if (teaserTransition) {
            await gsap.to(teaserTransition, {
                autoAlpha: 0,
                duration: 0.24,
                ease: "power2.out",
                overwrite: true,
                onComplete: () => teaserTransition.remove(),
            });
        }
        await showLocationMapPrelude(rankedPlayers[currentIndex], "opening");
        await showPlayer(currentIndex, "opening");
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
                    x: -72,
                    y: 0,
                    scale: 0.995,
                    duration: 0.36,
                    ease: "power3.inOut",
                    overwrite: true,
                },
                0,
            )
            .to(
                ".rank-badge",
                {
                    autoAlpha: 0,
                    x: -62,
                    y: 0,
                    scale: 0.96,
                    duration: 0.36,
                    ease: "power3.inOut",
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
                    x: -42,
                    scale: 0.98,
                    duration: 0.38,
                    ease: "power3.inOut",
                    overwrite: true,
                },
                0.04,
            )
            .to(
                ".ranking-plate",
                {
                    autoAlpha: 1,
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    "--plate-raised-edge": "21%",
                    duration: 0.38,
                    ease: "power3.inOut",
                    overwrite: "auto",
                },
                0.02,
            );
        await showLocationMapPrelude(rankedPlayers[nextIndex], "advance");
        await showPlayer(nextIndex, "advance");
    } else {
        await showLeaderboard();
    }

    transitionLocked = false;
    document.body.dataset.transitioning = "false";
}

// --- Reverse Presentation and click handler ---

async function reversePresentation() {
    if (transitionLocked || currentView === "error") return;

    if (currentView === "teaser") {
        return;
    }

    transitionLocked = true;
    document.body.dataset.transitioning = "true";

    if (currentView === "leaderboard") {
        await gsap
            .timeline()
            .to(
                ".leaderboard-panel",
                {
                    autoAlpha: 0,
                    x: 80,
                    scale: 0.985,
                    duration: 0.42,
                    ease: "power2.inOut",
                    pointerEvents: "none",
                    overwrite: true,
                },
                0,
            );

        await showPlayer(0, "back");
        transitionLocked = false;
        document.body.dataset.transitioning = "false";
        return;
    }

    const previousIndex = currentIndex + 1;
    if (previousIndex <= startingIndex && rankedPlayers[previousIndex]) {
        await gsap
            .timeline()
            .to(
                ".rank-card",
                {
                    autoAlpha: 0,
                    x: 72,
                    y: 0,
                    scale: 0.995,
                    duration: 0.36,
                    ease: "power3.inOut",
                    overwrite: true,
                },
                0,
            )
            .to(
                ".rank-badge",
                {
                    autoAlpha: 0,
                    x: 38,
                    y: 0,
                    scale: 0.96,
                    duration: 0.36,
                    ease: "power3.inOut",
                    overwrite: true,
                },
                0.02,
            )
            .to(
                ".pr-character .tsh_character",
                {
                    autoAlpha: 0,
                    x: 54,
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
                    x: 42,
                    scale: 0.98,
                    duration: 0.38,
                    ease: "power3.inOut",
                    overwrite: true,
                },
                0.04,
            )
            .to(
                ".ranking-plate",
                {
                    autoAlpha: 1,
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    "--plate-raised-edge": "21%",
                    duration: 0.38,
                    ease: "power3.inOut",
                    overwrite: "auto",
                },
                0.02,
            );

        await showLocationMapPrelude(rankedPlayers[previousIndex], "back");
        await showPlayer(previousIndex, "back");
    }

    transitionLocked = false;
    document.body.dataset.transitioning = "false";
}

function handlePresentationClick(event) {
    if (currentView === "teaser" && !teaserRegionMapShown) {
        void showTeaserRegionMap();
        return;
    }

    const clickIsOnRightHalf = event.clientX >= window.innerWidth / 2;

    if (clickIsOnRightHalf) {
        advancePresentation();
    } else {
        reversePresentation();
    }
}

LoadEverything().then(async () => {
    assignDefault(config, tsh_settings || {});
    assignDefault(config, window.config || {});

    if (!window.PLAYER) window.PLAYER = 1;
    document.body.classList.add(Number(window.PLAYER) === 2 ? "side-p2" : "side-p1");
    getFinalRevealAudio().load();

    Start = async () => {
        try {
            const rankingData = await loadRankingJson(config.ranking_json || DEFAULT_RANKING_JSON);
            rankedPlayers = sanitizeRankedPlayers(rankingData);

            if (rankedPlayers.length === 0) {
                showStreamSafeError("No ranked players with both placement and tag were found.");
                return;
            }

            currentIndex = getStartingIndex(rankedPlayers);
            startingIndex = currentIndex;

            if (window.PR_PRESENTATION_START_VIEW === "leaderboard") {
                await showLeaderboardInstant();
                transitionLocked = false;
                document.body.dataset.transitioning = "false";
                return;
            }

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

    window.addEventListener("click", handlePresentationClick);
    window.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
            advancePresentation();
        }

        if (event.key === "ArrowLeft") {
            reversePresentation();
        }
    });
});
