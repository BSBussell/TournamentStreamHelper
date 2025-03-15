const NUM_SETS = 3;

LoadEverything().then(() => {
  
  // TODO: Keep working on animations
  let startingAnimation = gsap
    .timeline({ paused: true })
    .from($(".recent_sets"), { autoAlpha: 0, scaleY: 0.1, transformOrigin: "top", duration: 0.15, ease: "back.out(1.5)" });

  let transitionAnimation = gsap
    .timeline({ paused: true })
    .to($(".recent_sets"), { scaleY: 0.1, transformOrigin: "top", duration: 0.075, ease: "power2.in" }) // Smooth shrink
    .add(() => updateRecentSetsContent()) // Change content at smallest size
    .to($(".recent_sets"), { scaleY: 1, transformOrigin: "top", duration: 0.125, ease: "power2.out" }); // Smooth expand

  var playersRecentSets = null;
  var players = [];

  Start = async (event) => {
    startingAnimation.restart();
  };

  var data = {};
  var oldData = {};
  var animationPlayed = false;
  recentSetsHtml = "";

  // Function to set inner HTML with recent sets html
  function updateRecentSetsContent() {
    $(`.recent_sets_content`).html(recentSetsHtml);
    recentSetsHtml = "";
  }


  Update = async (event) => {
    let data = event.data;
    let oldData = event.oldData;

    // If data has changed, update display
    if (
      !oldData.score ||
      JSON.stringify(oldData.score[window.scoreboardNumber].recent_sets) !=
        JSON.stringify(data.score[window.scoreboardNumber].recent_sets)
    ) {

      // Get Recent sets
      playersRecentSets = data.score[window.scoreboardNumber].recent_sets;
      console.log(playersRecentSets);

      players = [];
      

      // If resent sets is empty say no sets found
      if (playersRecentSets == null || 
        (playersRecentSets.state == "done" && playersRecentSets.sets.length == 0)
      ) {


        // Display no sets found
        recentSetsHtml += `NEVER PLAYED`;
        players = [];
        // $(`.recent_sets_content`).html(recentSetsHtml);

        // Hide lifetime by setting display to none
        $(`.lifetime`).css('display', 'none');
        // $(`.recent_sets`).css('display', 'none');
        
        // If played before, show transition animation
        if (animationPlayed) {
          transitionAnimation.restart();
        } else {
          updateRecentSetsContent();
        }
        animationPlayed = true;

      // Otherwise if we're waiting on recent sets
      } else if (playersRecentSets.state != "done") {
        

        // startingAnimation.restart();
        recentSetsHtml += `<div class="lds-ring"><div></div><div></div><div></div><div></div></div>`;
        players = [];

        // Hide and show the relevant elements, then fill in the content
        $(`.recent_sets`).css('display', 'flex');
        $(`.lifetime`).css('display', 'none');
        // $(`.recent_sets_content`).html(recentSetsHtml);

        // If played before, show transition animation
        if (animationPlayed) {
          transitionAnimation.restart();
        } else {
          updateRecentSetsContent();
        }
        animationPlayed = true;

      } else {
        if (
          !oldData.score ||
          JSON.stringify(oldData.score[window.scoreboardNumber].recent_sets) !=
            JSON.stringify(data.score[window.scoreboardNumber].recent_sets)
        ) {

          // Ensure lifetime is displayed
          $(`.lifetime`).css('display', 'flex');
          $(`.recent_sets`).css('display', 'flex');

          

          // Create a deep copy of the recent sets to avoid modifying the original data
          playersRecentSets = JSON.parse(JSON.stringify(data.score[window.scoreboardNumber].recent_sets));

          // Traverse recent sets, search for sets in the same tournament with the same players
          // If found, add the scores of the sets and remove one of the sets

          // Go through all sets
          if (playersRecentSets.sets.length > NUM_SETS) {
            for (let i = 0; i < playersRecentSets.sets.length; i++) {

              // Get the set and set flag found to false
              let set = playersRecentSets.sets[i];
              let found = false;

              // Go through all sets after the current set
              for (let j = i + 1; j < playersRecentSets.sets.length; j++) {

                // Get comparison set
                let set2 = playersRecentSets.sets[j];

                // If the sets are in the same tournament and same events then merge them
                // by adding the scores together and removing the second set
                if (set.tournament == set2.tournament && set.event == set2.event) {
                  set.score[0] += set2.score[0];
                  set.score[1] += set2.score[1];
                  playersRecentSets.sets.splice(j, 1);
                  j--;
                  found = true;
                }
              }
            }
          }

          console.log(playersRecentSets);

          recentSetsHtml += '<div class="recent_sets_inner">';



          playersRecentSets.sets.slice(0, NUM_SETS).forEach((_set, i) => {

            // set tourney name string
            let setTourneyName = _set.tournament;
            let setTourneyDate = new Date(_set.timestamp * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            });

            // if tourney name has UTK in it, remove the word esports
            if (setTourneyName.includes("UTK")) {
              setTourneyName = setTourneyName.replace(" Esports ", " ");

              // remove the 'Smash Weekly' portion
              setTourneyName = setTourneyName.replace(" Smash Weekly ", " Weekly ");
              
            }

            // cut tourney name to only 19 characters
            let char_limit = 20;
            if (setTourneyName.length > char_limit) {
              // Set the last three characters to ...
              setTourneyName = setTourneyName.substring(0, char_limit-3) + "...";
            }


            recentSetsHtml += `
                <div class="set_container set_${i}">
                  <div class="${_set.winner == 0 ? "set_winner" : "set_loser"}">
                    ${_set.score[0]}
                  </div>
                  <div class="set_info">
                    <div class="set_col col_1">
                        <div class="set_text">${setTourneyName}</div>
                        <div class="set_subtext">${setTourneyDate}</div>
                    </div>
                  </div>
                  <div class="${_set.winner == 1 ? "set_winner" : "set_loser"}">
                    ${_set.score[1]}
                  </div>
                </div>
              `;
          });
          recentSetsHtml += "</div>";
        }

        // $(`.recent_sets_content`).html(recentSetsHtml);
        

        // Fill in the the remaining sets icons 
        /*
        playersRecentSets.sets.slice(0, NUM_SETS).forEach((_set, i) => {


            // set tourney name string
            let setTourneyName = _set.tournament;

            

            // if tourney name has UTK in it, remove the word esports
            if (setTourneyName.includes("UTK")) {
              setTourneyName = setTourneyName.replace(" Esports ", " ");

              // IF tourney has : in it, remove the 'Smash Weekly' portion
              if (setTourneyName.includes(":")) {
                setTourneyName = setTourneyName.replace(" Smash Weekly ", " ");
              }
            }

            // cut tourney name to only 19 characters
            let char_limit = 20;
            if (setTourneyName.length > char_limit) {
              // Set the last three characters to ...
              setTourneyName = setTourneyName.substring(0, char_limit-3) + "...";
            }

            SetInnerHtml(
            $(`.set_${i} .col_1 .set_text`),
            (_set.online ? `<div class="wifi_icon"></div>` : "") +
              setTourneyName
            );
          SetInnerHtml(
            $(`.set_${i} .col_1 .set_subtext`),
            new Date(_set.timestamp * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })
          );
        });
        */

        // Don't care about duplicates anymore:
        playersRecentSets = data.score[window.scoreboardNumber].recent_sets;
        console.log(data.score[window.scoreboardNumber].recent_sets);

        // Display Lifetime set record
        
        // Find how many sets each player won
        let player1Sets = 0;
        let player2Sets = 0;

        // Go through all sets
        for (let i = 0; i < playersRecentSets.sets.length; i++) {
          let set = playersRecentSets.sets[i];

          // If player 1 won the set
          if (set.score[0] > set.score[1]) {
            player1Sets++;
          } else {
            player2Sets++;
          }
        }

        // Log total set record
        console.log(player1Sets, player2Sets);

        // Populate life time with:
        /*
        <div class="set_container">
            <div class="set_loser">0</div>
            <div class="lifetime_title">LIFETIME</div>
            <div class="set_winner">0</div>
          </div>
        */

        let p1_class = player1Sets > player2Sets ? "set_winner" : "set_loser";
        let p2_class = player2Sets > player1Sets ? "set_winner" : "set_loser";

        if (player1Sets == player2Sets) {
          p1_class = "set_tie";
          p2_class = "set_tie";
        }

        let lifetimeHtml = `
          <div class="set_container">
            <div class=${p1_class}>${player1Sets}</div>
            <div class="lifetime_title">Active Record</div>
            <div class=${p2_class}>${player2Sets}</div>
          </div>
        `;
        //Set the inner HTML of the lifetime container
        $(`.lifetime`).html(lifetimeHtml);


        // If played before, show transition animation
        if (animationPlayed) {
         
          // Wait for the animation to finish before updating the content
          await transitionAnimation.restart();
        } else {
          updateRecentSetsContent();
        }
        animationPlayed = true;
      }

    }

    for (const [t, team] of [
      data.score[window.scoreboardNumber].team["1"],
      data.score[window.scoreboardNumber].team["2"],
    ].entries()) {
      for (const [p, player] of [team.player["1"]].entries()) {
        if (player) {
          SetInnerHtml(
            $(`.recent_sets_players .player_${t + 1} .sponsor`),
            player.team
          );
          SetInnerHtml(
            $(`.recent_sets_players .player_${t + 1} .name`),
            await Transcript(player.name)
          );
        }
      }
    }
  };
});
