const TOURNAMENTS = 3;
const SETS = 4;
const FACTS_TRANSITION_DELAY = 10; // Time in seconds before transitioning to fun facts

let config = {
    display_titles: true,
};

function getNumberOrdinal(n) {
    var s = ["th", "st", "nd", "rd"],
        v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

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

    if (!window.PLAYER) {
        window.PLAYER = 1;
    }

    // Set the opacity of the starting panel to 1
    if (window.START_WITH_FACTS) {
        gsap.set("#fun-facts", { opacity: 1 });
    } else {
        gsap.set("#tournament-results", {opacity: 1});
    }
    
    // Flag to track if the content switch timer is already set
    let contentSwitchTimerSet = !window.ROTATE;

    let startingAnimation = gsap
        .timeline({ paused: true })
        .to([".logo"], { duration: 0.8, top: 160 }, 0)
        .to([".logo"], { duration: 0.8, scale: 0.4 }, 0)
        .from(
            [".tournament"],
            { duration: 0.6, opacity: "0", ease: "power2.inOut" },
            0.2,
        )
        .from(
            [".match"],
            { duration: 0.6, opacity: "0", ease: "power2.inOut" },
            0.4,
        )
        .from(
            [".score_container"],
            { duration: 0.8, opacity: "0", ease: "power2.inOut" },
            0,
        )
        .from(
            [".best_of.container"],
            { duration: 0.8, opacity: "0", ease: "power2.inOut" },
            0,
        )
        .from(
            [".vs1"],
            { duration: 0.1, opacity: "0", scale: 10, ease: "in" },
            1.2,
        )
        .from([".vs2"], { duration: 0.01, opacity: "0" }, 1.3)
        .to([".vs2"], { opacity: 0, scale: 2, ease: "power2.out" }, 1.31)
        .from([".p1.container"], { duration: 1, x: "-200px", ease: "out" }, 0)
        .from([".p2.container"], { duration: 1, x: "200px", ease: "out" }, 0);

    // Function to transition from tournament results to fun facts
    function switchToFunFacts() {
        // For player 1
        gsap.to("#tournament-results", { 
            duration: 0.5, 
            opacity: 0, 
            x: window.PLAYER == 1 ? -100 : 100, 
            ease: "power2.inOut",
            onComplete: () => {
                // $("#tournament-results").css("visibility", "hidden");
                gsap.fromTo("#fun-facts", 
                    { opacity: 0, x: window.PLAYER == 1 ? 100 : -100 },
                    { duration: 0.5, opacity: 1, x: 0, ease: "power2.inOut" }
                );
            }
        });
    }

    // Function to transition from fun facts to tournament results
    function switchToTournamentResults() {
        // For player 1
        gsap.to("#fun-facts", { 
            duration: 0.5, 
            opacity: 0, 
            x: window.PLAYER == 1 ? 100 : -100, 
            ease: "power2.inOut",
            onComplete: () => {
                // $("#fun-facts").css("visibility", "hidden");
                gsap.fromTo("#tournament-results", 
                    { opacity: 0, x: window.PLAYER == 1 ? -100 : 100 },
                    { duration: 0.5, opacity: 1, x: 0, ease: "power2.inOut" }
                );
            }
        });
    }

    Start = async (event) => {
        startingAnimation.restart();
    };

    Update = async (event) => {
        let data = event.data;
        let oldData = event.oldData;

        console.log("UPDATE -------------------");

        let isTeams =
            Object.keys(data.score[window.scoreboardNumber].team["1"].player)
                .length > 1;

        if (!isTeams) {
            console.log("HEY LOOK HERE ---------------");
            const teams = Object.values(
                data.score[window.scoreboardNumber].team,
            );
            for (const [t, team] of teams.entries()) {
                const players = Object.values(team.player);
                for (const [p, player] of players.entries()) {
                    SetInnerHtml(
                        $(`.p${t + 1} .name`),
                        `
              <span>
                  <div>
                    <span class='sponsor'>
                        ${player.team ? player.team : ""}
                    </span>
                    ${await Transcript(player.name)}
                  </div>
              </span>
            `,
                    );

                    SetInnerHtml($(`.p${t + 1} .pronoun`), player.pronoun);

                    SetInnerHtml(
                        $(`.p${t + 1} > .sponsor_logo`),
                        player.sponsor_logo
                            ? `
                <div class='sponsor_logo' style='background-image: url(../../${player.sponsor_logo})'></div>
                `
                            : "",
                    );

                    SetInnerHtml($(`.p${t + 1} .real_name`), player.real_name);

                    SetInnerHtml(
                        $(`.p${t + 1} .seed`),
                        player.seed ? `Seed ${player.seed}` : "",
                    );

                    let characterNames = [];

                    if (!window.ONLINE_AVATAR && !window.PLAYER_AVATAR) {
                        for (const [p, player] of Object.values(
                            team.player,
                        ).entries()) {
                            let characters = _.get(player, "character");
                            for (const c of Object.values(characters)) {
                                if (c.name) characterNames.push(c.name);
                            }
                        }
                    }

                    SetInnerHtml(
                        $(`.p${t + 1} .character_name`),
                        `
                ${characterNames.join(" / ")}
            `,
                    );

                    SetInnerHtml(
                        $(`.p${t + 1} .twitter`),
                        `
              ${
                  player.twitter
                      ? `
                  <div class="twitter_logo"></div>
                  ${player.twitter}
                  `
                      : ""
              }
          `,
                    );

                    SetInnerHtml(
                        $(`.p${t + 1} .flagcountry`),
                        player.country.asset
                            ? `
              <div>
                  <div class='flag' style='background-image: url(../../${player.country.asset});'>
                      <div class="flagname">${player.country.code}</div>
                  </div>
              </div>`
                            : "",
                    );

                    SetInnerHtml(
                        $(`.p${t + 1} .flagstate`),
                        player.state.asset
                            ? `
              <div>
                  <div class='flag' style='background-image: url(../../${player.state.asset});'>
                      <div class="flagname">${player.state.code}</div>
                  </div>
              </div>`
                            : "",
                    );

                    let zIndexMultiplyier = 1;
                    if (t == 1) zIndexMultiplyier = -1;

                    if (!window.ONLINE_AVATAR && !window.PLAYER_AVATAR) {
                        await CharacterDisplay(
                            $(`.p${t + 1}.character`),
                            {
                                source: `score.${window.scoreboardNumber}.team.${t + 1}`,
                                scale_based_on_parent: true,
                                anim_out: {
                                    x: -zIndexMultiplyier * 100 + "%",
                                    stagger: 0.1,
                                },
                                anim_in: {
                                    x: 0,
                                    duration: 1,
                                    ease: "expo.out",
                                    autoAlpha: 1,
                                    stagger: 0.2,
                                },
                            },
                            event,
                        );
                    } else if (window.ONLINE_AVATAR) {
                        SetInnerHtml(
                            $(`.p${t + 1}.character`),
                            `
                <div class="player_avatar">
                  <div style="background-image: url('${
                      player.online_avatar
                          ? player.online_avatar
                          : "./person.svg"
                  }');">
                  </div>
                </div>
              `,
                            {
                                anim_out: {
                                    x: -zIndexMultiplyier * 100 + "%",
                                    stagger: 0.1,
                                },
                                anim_in: {
                                    x: 0,
                                    duration: 1,
                                    ease: "expo.out",
                                    autoAlpha: 1,
                                    stagger: 0.2,
                                },
                            },
                        );
                    } else {
                        SetInnerHtml(
                            $(`.p${t + 1}.character`),
                            `
                <div class="player_avatar">
                  <div style="background-image: url('${
                      player.avatar ? "../../" + player.avatar : "./person.svg"
                  }');">
                  </div>
                </div>
              `,
                            {
                                anim_out: {
                                    x: -zIndexMultiplyier * 100 + "%",
                                    stagger: 0.1,
                                },
                                anim_in: {
                                    x: 0,
                                    duration: 1,
                                    ease: "expo.out",
                                    autoAlpha: 1,
                                    stagger: 0.2,
                                },
                            },
                        );
                    }
                }
            }

            // ------- TOURNAMENT RESULTS -------------
            let history =
                data.score[window.scoreboardNumber].history_sets[window.PLAYER];
            if (history) {
                let results_html = `<div class ="info title">${config.display_titles ? "Recent Results" : " "}</div>`;

                let className = `.results`;
                let tl = gsap.timeline();

                // Output
                console.log("-- Output tournaments --");
                console.log(data);
                console.log(data.score[window.scoreboardNumber]);
                console.log(data.score[window.scoreboardNumber].history_sets[window.PLAYER]);


                function major_filter(tournament) {
                    // Ensure entrant count is greater than 80
                    let major = tournament.entrants > 80;
                    
                    // Check if the tournament is not the current tournament
                    let not_current = tournament.tournament_name != data.tournamentInfo.tournamentName;

                    // Ensure it isn't a wifi tournament by removing wifi from the name
                    let not_wifi = !tournament.tournament_name.toLowerCase().includes("wifi") 
                    && !tournament.tournament_name.toLowerCase().includes("lan")
                    && !tournament.tournament_name.toLowerCase().includes("sundown")
                    && !tournament.event_name.toLowerCase().includes("online");

                    // Check if the tournament has more than 25 entrants
                    return major && not_current && not_wifi;
                }

                function not_current(tournament) {
                    
                    // Check if the tournament is not the current tournament
                    let not_current = tournament.tournament_name != data.tournamentInfo.tournamentName;

                    // Ensure it isn't a wifi tournament by removing wifi from the name
                    let not_wifi = !tournament.tournament_name.toLowerCase().includes("wifi") 
                    && !tournament.tournament_name.toLowerCase().includes("lan")
                    && !tournament.tournament_name.toLowerCase().includes("sundown")
                    && !tournament.tournament_name.toLowerCase().includes("howling at the moon")
                    && !tournament.event_name.toLowerCase().includes("online");

                    return not_current && not_wifi;
                }


                let tournaments = Object.values(
                    data.score[window.scoreboardNumber].history_sets[window.PLAYER],
                ).filter(major_filter);

                let remainingTournaments = Object.values(
                    data.score[window.scoreboardNumber].history_sets[window.PLAYER],
                )
                .filter(not_current)
                .sort((a, b) => b.entrants - a.entrants); // Sort by largest entrants first


                // If tournaments are less than 3, then grab the next tournament to fill the gap
                while (tournaments.length < TOURNAMENTS && remainingTournaments.length > 0) {
                    
                    console.log("Not enough tournaments, grabbing more");
                    console.log(tournaments);

                    // Find the largest tournament not already in the array
                    let largestTournament = remainingTournaments.find(
                        (tournament) =>
                            !tournaments.some(
                                (existing) =>
                                    existing.tournament_name === tournament.tournament_name,
                            ),
                    );

                    // Add the largest tournament to the array if it exists
                    if (largestTournament) {
                        tournaments.push(largestTournament);
                    }
                }

                // Sort tournaments by date:
                tournaments.sort((a, b) => {
                    let aDate = new Date(
                        `${a.event_date_month} ${a.event_date_day}, ${a.event_date_year}`,
                    );
                    let bDate = new Date(
                        `${b.event_date_month} ${b.event_date_day}, ${b.event_date_year}`,
                    );
                    return bDate - aDate;
                });

                // if there are no tournaments.
                if (tournaments.length == 0) {
                    window.START_WITH_FACTS = true;
                    window.ROTATE = false;
                    contentSwitchTimerSet = true;
                }

                tournaments.slice(0, TOURNAMENTS)
                .forEach((sets, s) => {
                    results_html += `
                    <div class="tournament${s + 1} tournament_container">
                        <div class="tournament_container_inner">
                            <div class="tournament_logo"></div>
                            <div class="placement"></div>
                            <div class="tournament_info">
                                <div class="tournament_name"></div>
                                <div class="event_name"></div>
                            </div>
                        </div>
                    </div>`;
                });
                $(className).html(results_html);

                for (const [s, tournament] of tournaments
                .slice(0, TOURNAMENTS)
                .entries()) {
                    SetInnerHtml(
                        $(
                            `${className} .tournament${
                            s + 1
                            } .tournament_container_inner .tournament_info .tournament_name`,
                        ),
                        tournament.tournament_name,
                    );
                    SetInnerHtml(
                        $(
                            `${className} .tournament${
                            s + 1
                            } .tournament_container_inner .tournament_info .event_name`,
                        ),
                        tournament.event_name,
                    );
                    SetInnerHtml(
                        $(
                            `${className} .tournament${s + 1} .tournament_container_inner .tournament_logo`,
                        ),
                        `
                            <span class="logo" style="background-image: url('${tournament.tournament_picture}')"></span>
                        `,
                    );
                    SetInnerHtml(
                        $(
                            `${className} .tournament${s + 1} .tournament_container_inner .placement`,
                        ),
                        tournament.placement +
                            `<span class="ordinal">${getNumberOrdinal(
                            tournament.placement,
                            )}</span><span class="num_entrants">/${tournament.entrants}</span>`,
                    );
                    tl.from(
                        $(`.tournament${s + 1}`),
                        { x: window.PLAYER == 1 ? 100 : -100, autoAlpha: 0, duration: 0.3 },
                        0.2 + 0.2 * s,
                    );
                }
                tl.resume();
                
                // ------- FUN FACTS -------------
                let facts_html = `<div class ="info title">${config.display_titles ? "Fun Facts" : " "}</div>`;
                fetch("../DATA/facts.json")
                    .then((response) => response.json())
                    .then((facts) => {
                        // Populate player names with each player on the team
                        var playerNames = [];
                        Object.values(
                            data.score[window.scoreboardNumber].team[window.PLAYER].player,
                        ).forEach((player) => {
                            console.log(player);
                            playerNames.push(player.name);
                        });

                        // Populate player facts with each player's facts
                        let playerFacts = [];
                        playerNames.forEach((name) => {
                            // get each player's facts
                            let playerFact = facts[name];

                            // add the player's facts to the list
                            if (playerFact)
                                playerFacts = playerFacts.concat(playerFact);
                        });

                        console.log(playerFacts);

                        // If there are no facts for the player, use the default
                        if (playerFacts.length == 0) playerFacts = facts["default"];

                        // If there are more than 4 facts grab 4 randomly
                        if (playerFacts.length > TOURNAMENTS) {
                            playerFacts = playerFacts
                                .sort(() => Math.random() - 0.5)
                                .slice(0, TOURNAMENTS);
                        // Otherwise if we have less than 3 facts, add random default facts so we have 3
                        } else if (playerFacts.length < TOURNAMENTS) {
                            let seed = new Date().getDate();
                            let defaultFacts = facts["default"];
                            while (playerFacts.length < TOURNAMENTS) {
                                playerFacts.push(defaultFacts[Math.floor(Math.random() * defaultFacts.length)]);
                            }

                            // Now shuffle the facts
                            playerFacts = playerFacts.sort(() => Math.random() - 0.5);
                        // Otherwise just shuffle the facts
                        } else {
                            let seed = new Date().getDate();
                            playerFacts = playerFacts.sort(
                                () => Math.random() - 0.5,
                            );
                        }

                        // Build the html for each fact
                        playerFacts.forEach((fact, i) => {
                            facts_html += `
                                <div class="fact${i + 1} tournament_container">
                                    <div class="tournament_container_inner">
                                        <div class="fact_info">
                                            <div class="fun_fact">${fact}</div>
                                        </div>
                                    </div>
                                </div>`;
                        });
                        
                        $(`.facts`).html(facts_html);

                        // Animate the fun facts display
                        let tl = gsap.timeline();
                        playerFacts.forEach((fact, i) => {
                            tl.from(
                                $(`.fact${i + 1}`),
                                { x: window.PLAYER == 1 ? 100 : -100, autoAlpha: 0, duration: 0.3 },
                                0.2 + 0.2 * i,
                            );
                        });
                        tl.resume();
                    });
                
                // Set up the transition timer only once
                if (!contentSwitchTimerSet) {
                    contentSwitchTimerSet = true;

                    const cycleContent = (showFactsFirst) => {
                        if (showFactsFirst) {
                            switchToTournamentResults();
                            setTimeout(() => cycleContent(false), FACTS_TRANSITION_DELAY * 1000);
                        } else {
                            switchToFunFacts();
                            setTimeout(() => cycleContent(true), FACTS_TRANSITION_DELAY * 1000);
                            
                        }
                    };

                    setTimeout(() => cycleContent(window.START_WITH_FACTS), FACTS_TRANSITION_DELAY * 1000);
                }
            }
            
            //------ BRACKET RUN --------
            let last_sets = data.score[window.scoreboardNumber].last_sets[window.PLAYER];
            let oldLastSets = _.get(oldData, `score[${window.scoreboardNumber}].last_sets[${window.PLAYER}]`);
            console.log("SETS", last_sets);
            
            if (JSON.stringify(last_sets) != JSON.stringify(oldLastSets)){
                let sets_html = `<div class ="info title">${config.display_titles ? "Current Run" : " "}</div>` ;
                Object.values(last_sets)
                    .slice(0, SETS)
                    .reverse()
                    .forEach((set, s) => {
                    let winner = set.player_score > set.oponent_score;

                    // Enable DQ support
                    let result = winner ? "W" : "L";
                    if (set.player_score == -1) result = "DQ";

                    sets_html += `
                        <div class ="set${s + 1} set_container">
                            <div class = "set_container_inner">
                                <div class = "result_tag ${winner ? "winner" : ""}">${result}</div>
                                <div class = "phase_match"></div>
                                <div class = "set_score"></div>
                                <div class = "name"></div>
                            </div>
                        </div>
                    `;
                });


                if (Object.values(last_sets).length > 0) {

                    $(".sets").html(sets_html);
                }

                let tl = gsap.timeline();
                for (const [s, set] of Object.values(last_sets)
                    .slice(0, SETS)
                    .reverse()
                    .entries()) {
                    console.log(set);
                    let phaseTexts = [];

                    if (set.phase_id) phaseTexts.push(set.phase_id);
                    
                    SetInnerHtml($(`.sets .set${s + 1} .phase_match`), set.round_name);
                    SetInnerHtml(
                        $(`.sets .set${s + 1} .name`),
                        `
                            <div class = "versus">VS</div>
                            ${await Transcript(set.oponent_name)}
                            ${set.oponent_team ? `<span class="sponsor">${set.oponent_team}</span>` : ""}
                        `,
                    );
                    let score_text = "" + set.player_score + " - " + (set.oponent_score >= 0 ? set.oponent_score : "DQ");
                    SetInnerHtml(
                        $(`.sets .set${s + 1} .set_score`),
                        score_text,
                    );
                    tl.from(
                        $(`.set${s + 1}`),
                        { x: window.PLAYER == 1 ? 100 : -100, autoAlpha: 0, duration: 0.4 },
                        0.2 + 0.2 * s,
                    );
                }
                tl.resume();
            }
        } else {
            const teams = Object.values(data.score[window.scoreboardNumber].team);
            for (const [t, team] of teams.entries()) {
                let teamName = team.teamName;

                let names = [];
                for (const [p, player] of Object.values(
                    team.player,
                ).entries()) {
                    if (player && player.name) {
                        names.push(await Transcript(player.name));
                    }
                }
                let playerNames = names.join(" / ");

                if (!team.teamName || team.teamName == "") {
                    teamName = playerNames;
                }

                SetInnerHtml(
                    $(`.p${t + 1} .name`),
                    `
                    <span>
                        <div>
                            ${teamName}
                        </div>
                    </span>
                    `,
                );
                if (teamName != playerNames) {
                    SetInnerHtml($(`.p${t + 1} .real_name`), playerNames);
                } else {
                    SetInnerHtml($(`.p${t + 1} .real_name`), "");
                }

                gsap.to($(`.p${t + 1} .losers_badge`), {
                    autoAlpha: team.losers ? 1 : 0,
                    overwrite: true,
                    duration: 0.8,
                });

                SetInnerHtml($(`.p${t + 1} > .sponsor_logo`), "");

                SetInnerHtml($(`.p${t + 1} .twitter`), ``);

                SetInnerHtml($(`.p${t + 1} .flagcountry`), "");

                SetInnerHtml($(`.p${t + 1} .flagstate`), "");

                SetInnerHtml($(`.p${t + 1} .pronoun`), "");

                SetInnerHtml(
                    $(`.p${t + 1} .seed`),
                    _.get(team, "player.1.seed")
                        ? `Seed ${_.get(team, "player.1.seed")}`
                        : "",
                );

                let characterNames = [];

                if (!window.ONLINE_AVATAR && !window.PLAYER_AVATAR) {
                    for (const [p, player] of Object.values(
                        team.player,
                    ).entries()) {
                        let characters = _.get(player, "character");
                        for (const c of Object.values(characters)) {
                            if (c.name) characterNames.push(c.name);
                        }
                    }
                }

                SetInnerHtml(
                    $(`.p${t + 1} .character_name`),
                    `
                      ${characterNames.join(" / ")}
                    `,
                );

                let zIndexMultiplyier = 1;
                if (t == 1) zIndexMultiplyier = -1;

                if (!window.ONLINE_AVATAR && !window.PLAYER_AVATAR) {
                    await CharacterDisplay(
                        $(`.p${t + 1}.character`),
                        {
                            source: `score.${window.scoreboardNumber}.team.${t + 1}`,
                            scale_based_on_parent: true,
                            anim_out: {
                                x: -zIndexMultiplyier * 100 + "%",
                                stagger: 0.1,
                            },
                            anim_in: {
                                x: 0,
                                duration: 1,
                                ease: "expo.out",
                                autoAlpha: 1,
                                stagger: 0.2,
                            },
                        },
                        event,
                    );
                } else if (window.ONLINE_AVATAR) {
                    let avatars_html = "";
                    for (const [p, player] of Object.values(
                        team.player,
                    ).entries()) {
                        if (player)
                            avatars_html += `<div style="background-image: url('${
                                player.online_avatar
                                    ? player.online_avatar
                                    : "./person.svg"
                            }');"></div>`;
                    }
                    SetInnerHtml(
                        $(`.p${t + 1}.character`),
                        `
                          <div class="player_avatar">
                            ${avatars_html}
                          </div>
                        `,
                        {
                            anim_out: {
                                x: -zIndexMultiplyier * 100 + "%",
                                stagger: 0.1,
                            },
                            anim_in: {
                                x: 0,
                                duration: 1,
                                ease: "expo.out",
                                autoAlpha: 1,
                                stagger: 0.2,
                            },
                        },
                    );
                } else {
                    let avatars_html = "";
                    for (const [p, player] of Object.values(
                        team.player,
                    ).entries()) {
                        if (player)
                            avatars_html += `<div style="background-image: url('${
                                player.avatar
                                    ? "../../" + player.avatar
                                    : "./person.svg"
                            }');"></div>`;
                    }
                    SetInnerHtml(
                        $(`.p${t + 1}.character`),
                        `
                          <div class="player_avatar">
                            ${avatars_html}
                          </div>
                        `,
                        {
                            anim_out: {
                                x: -zIndexMultiplyier * 100 + "%",
                                stagger: 0.1,
                            },
                            anim_in: {
                                x: 0,
                                duration: 1,
                                ease: "expo.out",
                                autoAlpha: 1,
                                stagger: 0.2,
                            },
                        },
                    );
                }
            }
        }

        SetInnerHtml(
            $(`.p1 .score`),
            String(data.score[window.scoreboardNumber].team["1"].score),
        );
        SetInnerHtml(
            $(`.p2 .score`),
            String(data.score[window.scoreboardNumber].team["2"].score),
        );

        let stage = null;

        if (
            _.get(data, `score.${window.scoreboardNumber}.stage_strike.selectedStage`)
        ) {
            let stageId = _.get(
                data,
                `score.${window.scoreboardNumber}.stage_strike.selectedStage`,
            );

            let allStages = _.get(data, "score.ruleset.neutralStages", []).concat(
                _.get(data, "score.ruleset.counterpickStages", []),
            );

            stage = allStages.find((s) => s.codename == stageId);
        }

        if (
            stage &&
            _.get(
                data,
                `score.${window.scoreboardNumber}.stage_strike.selectedStage`,
            ) !=
                _.get(
                    oldData,
                    `score.${window.scoreboardNumber}.stage_strike.selectedStage`,
                )
        ) {
            gsap.fromTo(
                $(`.stage`),
                { scale: 2 },
                { scale: 1.2, duration: 0.8, ease: "power2.out" },
            );
        }

        SetInnerHtml(
            $(`.stage`),
            stage
                ? `
                <div>
                    <div class='' style='background-image: url(../../${stage.path});'>
                    </div>
                </div>`
                : "",
        );
    };
});