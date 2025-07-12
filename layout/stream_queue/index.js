LoadEverything().then(() => {
    let config = {
        "assets": {
          "default": {}
        },
        "stream": "",
        "default_stream" : "",
        "sets_displayed" : -1,
        "display_first_set": true,
        "station" : -1,
        "currentEventOnly": false,
        "display" : {
            "station" : false,
            "country_flag" : true,
            "state_flag" : true,
            "avatar" : true,
            "stream_name": "multistream"
        },
        "minimum_determined_players": 1
    }
    
    function isDefault(value){
        return value === "" || value === -1 || value === undefined || value === null
    }

    let window_config = window.config || {}

    function assignDefault(target, source){
        for (k in target){
            let value = source[k]
            if (typeof value === 'object' && value !== null){
                let matchingObject = target[k];
                if (typeof matchingObject != 'object'){
                    matchingObject = value;
                } else {
                    assignDefault(matchingObject, value);
                }
            }
            if (!isDefault(value)){
                target[k] = value
            }
        }
    }

    assignDefault(config, tsh_settings);
    assignDefault(config, window_config);

    if (!config.display){
        config.display = {};
    }

    let first_index = config.display_first_set ? 0 : 1    
    let sets_nb = config.sets_displayed;
    if (sets_nb < 0) sets_nb = undefined;

    gsap.config({ nullTargetWarn: false, trialWarn: false });

    //let startingAnimation = gsap.timeline({ paused: true });

    Start = async (event) => {
        //startingAnimation.restart();
    };

    /**
     * Wraps content in a .text element to emulate SetInnerHtml's behavior.
     */
    function wrap_text(txt){
        return `
            <div class = "text">${txt}</div>
        `
    }
    
    current_set_nb = 0; // ooooo dirty ass global var     fuck you ~ Bee <3
    function resetSetsCount(){
        current_set_nb = 0;
    }

    function findPlayer(playerList, tag) {
        const teams = Object.values(playerList.slot);
        for (let i = 0; i < teams.length; i++) {
          const players = Object.values(teams[i].player);
          for (let j = 0; j < players.length; j++) {
            if (players[j] && players[j].name && players[j].name.toLowerCase() === tag.toLowerCase()) {
              // Store the slot index for later use
              players[j].slotIndex = i + 1;

              console.log(`Found player: ${players[j].name} in slot ${i + 1}`);
              console.log(players[j]);
              return players[j];
            }
          }
        }
        return null;
      }


    function character_html(player, t) {
        return `
            <div class = "character_container character_${t}">
            </div>
        `
    }


    function online_avatar_html(player, t){
        
        return `
            <div class = "p${t}_avatar avatar_container"> 
                <span class="avatar" style="background-image: url('${player.online_avatar}')"></span>
            </div>
        `
    }

    async function team_html(set, t, s, isTeams, resolver){

        let team = set.team[""+t];

        if (!team) return `<div class = "p${t} tbd_container"><div class = "TBD">TBD</div></div>`;

        let player = team.player["1"];

        resolver.add(`.set${current_set_nb} .p${t} .tag`, 
            isTeams ? team.name :
                `
                <span class="sponsor">
                    ${player.team ? player.team : ""}
                </span>
                ${await Transcript(player.name)}
                ${team.losers ? "<span class='losers'>L</span>" : ""}
                `
        )

        resolver.add(`.set${s - 1} .p${t} .twitter`, 
            (!isTeams) ?  `<span class="twitter_logo"></span>${String(player.twitter)}` : ""  
        )

        return `
            <div class = "p${t} team">
                ${isTeams || !config.display.avatar ? "" : online_avatar_html(player, t)}
                <div class = "flags">
                    ${ isTeams ? "" : 
                        (player.country.asset && config.display.country_flag ? `<div class='flag' style='background-image: url(../../${player.country.asset.toLowerCase()})'></div>` : "") + 
                        (player.state.asset && config.display.state_flag? `<div class='flag' style='background-image: url(../../${player.state.asset.toLowerCase()})'></div>` : "")
                    }
                </div>
                <div class = "name">
                    <div class = "tag"></div>
                    <div class = "extra">
                        ${ player.twitter ?
                            ` <div class = "twitter">  </div> ` : ''
                        }
                        ${ player.pronoun && false ?
                            ` <div class = "pronoun"> ${ wrap_text((!isTeams && true) ?  String(player.pronoun) : "") } </div>` : ''
                        }
                        ${ player.seed ?
                            `<div class = "seed"> ${wrap_text("Seed " + player.seed)} </div> ` : ''
                        }
                       
                        
                    </div>
                </div>
            </div>
        `
    }

    async function queue_html(queue, resolver, display_set_station, station = -1){
        let html = "";


        for (const [s, set] of Object.values(queue).slice(first_index).entries()){
            if (sets_nb && (current_set_nb >= sets_nb)) break;
            if (!set.team) continue;
            if (config.minimum_determined_players > 0 && !set.team[""+config.minimum_determined_players]) continue;

            if (config.currentEventOnly && !set.isCurrentEvent) continue;
            if (station != -1 && station != set.station) continue;

            let isTeams = set.team["1"] && Object.keys(set.team["1"].player).length > 1;

            html += `
                <div class="set${current_set_nb} set">
                    ${ await team_html(set, 1, s + 1 , isTeams, resolver) }
                    <div class = "vs_container">
                        <div class = "vs vs_${config.display.station ? 'small' : 'big'}">VS</div>
                        ${display_set_station && set.station && set.station != -1 ? '<div class = "station"></div>' : ''}
                        <div class = "phase"> </div>
                        <div class = "match"> </div>

                    </div>
                    ${ await team_html(set, 2, s + 1, isTeams, resolver) }
                </div>
            `;

            

            resolver.add(`.set${current_set_nb} .match`, set.match);
            resolver.add(`.set${current_set_nb} .phase`, set.phase);
            resolver.add(`.set${current_set_nb} .station`, "Station " + set.station);

            current_set_nb++;
        }

        return html;
    }

    function stream_name_html(stream){
        return `<div class = "message"><img class = "twitch_logo" src = "./twitch.svg"></img>/${stream}</div>`
    }

    let previous_display = null;

    async function display_allstream(data, oldData){
        console.log("Display AllStream")
        if (previous_display == 1 && oldData.streamQueue && JSON.stringify(data.streamQueue) != JSON.stringify(oldData.streamQueue)) return;

        previous_display = 1

        let html = ""
        let resolver = new ContentResolver();
        

        resetSetsCount();

        for (stream in data.streamQueue){
            // if (config.display.stream_name){
            //     html += stream_name_html(stream)
            // }
            html += `<div class="title">Up Next!</div>`;
            html += await queue_html(data.streamQueue[stream], resolver, config.display.station, config.station)
        }

        update_content(html, resolver);
    }

    async function display_stream(data, oldData, streamName){
        console.log("Display Stream", streamName)

        if (previous_display == streamName && oldData.streamQueue && (!data.streamQueue || JSON.stringify(data.streamQueue[streamName]) == JSON.stringify(oldData.streamQueue[streamName]))) return;

        previous_display = streamName

        let html = ""
        let resolver = new ContentResolver();

        // title
        html += `<div class="title">Up Next!</div>`;


        let queue = data.streamQueue[streamName];
        if (queue)  {
            if (config.display.stream_name == true){
                html += stream_name_html(streamName)
            }
    
            resetSetsCount();
            html += await queue_html(queue, resolver, config.display.station, config.station);
        }


        update_content(html, resolver);

        // Check if character containers exist
        // if ($(".character_container").length != 0){
        //     console.log("Character containers found, loading characters");
        
        //     setTimeout(() => {
        //         waitForPlayerDataAndLoad(data, queue);
        //     }, 900); // Defer to next event loop tick
        // }

    }

    async function display_station(data, oldData){
        console.log("Display Station")
        if (previous_display == 2 && oldData.score && oldData.score[window.scoreboardNumber].station_queue && JSON.stringify(data.score[window.scoreboardNumber].station_queue) == JSON.stringify(oldData.score[window.scoreboardNumber].station_queue)) return;
    
        previous_display = 2

        let html = ""
        let resolver = new ContentResolver();
        let queue = data.score[window.scoreboardNumber].station_queue;
        if (queue) {
            html += await queue_html(queue, resolver, false);
        }

        update_content(html, resolver)
    }


    function update_content(html, resolver){
            //console.log(html);
            $(".stream_queue_content").html(html);
            resolver.resolve()

            let tl = gsap.timeline();
            for (let i = 0; i <= current_set_nb; i++){
                tl.from(
                    $(`.set${i}`),
                    { x: -100, autoAlpha: 0, duration: 0.3, onComplete: () => {console.log("COMPLETED")} },
                    0.2 + 0.2 * i,
                );
            }
            tl.from(
                $(`.message`),
                {autoAlpha: 0, duration : 0.3},
                0.3 + 0.2 * current_set_nb
            );

            // Set on finish to populate the character containers
            tl.eventCallback("onComplete", () => {
                // Check if character containers exist
                if ($(".character_container").length != 0){
                    console.log("Character containers found, loading characters");
                    load_characters(data);
                }
            });
            tl.resume();
    }


    // Base Character loading function:
    // Update character display for player1
    // await CharacterDisplay(
    //     setContainer.find(".character1"),
    //     {
    //       source: `player_list.slot.${player1 ? player1.slotIndex : set.P1}`,
    //       custom_center: [0.5, 0.3],
    //       scale_based_on_parent: true
    //     },
    //     event
    //   );
    // FindPlayer function:
    // Player findPlayer(playerList, tag)    
    // Search through the character containers and fill them in with the right character
    function load_characters(data){
        

        let playerList = data.player_list;

        // Get first queue
        let queue = data.streamQueue["UTKEsports"];
        if (!queue) {
            console.warn("No queue found for UTKEsports");
            return;
        }

        
        for (let i = 0; i <= 4; i++) {
            const set = queue[i];
            if (!set || !set.team) continue;
            const setContainer = $(`.set${i-1}`);
            const character1Container = setContainer.find(".character_1");
            const character2Container = setContainer.find(".character_2");

            const player1 = set.team["1"]?.player?.["1"];
            const player2 = set.team["2"]?.player?.["1"];

            const found1 = player1 ? findPlayer(playerList, player1.name) : null;
            const found2 = player2 ? findPlayer(playerList, player2.name) : null;

            console.log("Found player 1:", found1);
            console.log("Found player 2:", found2);

            if (character1Container.length > 0 && found1?.slotIndex !== undefined) {
                CharacterDisplay(
                    character1Container,
                    {
                        source: `player_list.slot.${found1.slotIndex}`,
                        custom_center: [0.5, 0.3],
                        scale_based_on_parent: true
                    }
                );
            }

            if (character2Container.length > 0 && found2?.slotIndex !== undefined) {
                CharacterDisplay(
                    character2Container,
                    {
                        source: `player_list.slot.${found2.slotIndex}`,
                        custom_center: [0.5, 0.3],
                        scale_based_on_parent: true
                    }
                );
            }
        }
    }

    Update = async (event) => {
        let data = event.data;
        let oldData = event.oldData;


        //let stream = config.stream || data.score[window.scoreboardNumber].station || config.default_stream
        console.log("---- data : ", data, oldData)

        if (!data.score) return;

        if (config.stream && !config.force_multistream){
            
            if (config.stream == "all"){
                display_allstream(data, oldData);
            } else {
                display_stream(data, oldData, config.stream)
            }
        } else {
            let tsh_station = data.score[window.scoreboardNumber].station;
            if (tsh_station){
                if (data.score[window.scoreboardNumber].auto_update == "station"){
                    display_station(data, oldData);
                } else {
                    display_stream(data, oldData, tsh_station)
                }
            } else if (config.default_stream) {
                display_stream(data, oldData, config.default_stream);
            } else {
                display_allstream(data, oldData);
            }
        }

        /*
        if (
            !oldData.streamQueue ||
            JSON.stringify(data.streamQueue) !=
            JSON.stringify(oldData.score.streamQueue) || 
            ( !tsh_settings.stream && oldData.score[window.scoreboardNumber].station != data.score[window.scoreboardNumber].station)
        ) {


            
            if (!stream){
                $(".stream_queue_content").html('<div class = "message">No stream (twitch username) selected. Enter one in TSH or set the "stream" or "default_stream" value in this layout\'s settings.json</div>');
                return;
            }
        }
        */
        

    }
})