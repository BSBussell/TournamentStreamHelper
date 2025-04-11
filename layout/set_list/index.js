

LoadEverything().then(() => {
  gsap.config({ nullTargetWarn: false, trialWarn: false });

  let startingAnimation = gsap
    .timeline({ paused: true })
    .from([".container"], { duration: 1, width: "0", ease: "power2.inOut" }, 0)
    .from([".players_container"], { duration: 1.0, opacity: 0, y: 1000, ease: "power2.inOut" }, 0);


  let runOnce = false;

  Start = async (event) => {




    // setTimeout(() => {
    //   autoScrollPlayers();
    // }, 500);
  };

  Update = async (event) => {
    let data = event.data;
    let oldData = event.oldData;

    let index = 0

    if (runOnce) {
      return;
    }

    // return;
    // Load and build set list from ../DATA/set_history.json
    $.getJSON("../DATA/set_history.json", function(setHistory) {
      let html = "";

      // shuffle the sets
      setHistory.Sets.sort(() => Math.random() - 0.5);

      setHistory.Sets.forEach((set, index) => {
        let p1Class = "";
        let p2Class = "";
        if (set.Score[0] > set.Score[1]) {
          p1Class = "winner";
          p2Class = "loser";
        } else if (set.Score[0] < set.Score[1]) {
          p1Class = "loser";
          p2Class = "winner";
        } else {
          p1Class = "draw";
          p2Class = "draw";
        }
        html += `<div class="set_container set${index + 1}">`;
          html += `<div class="p1 score ${p1Class}">${set.Score[0]}</div>`;
          html += `<div class="name name1"></div>`;
          html += `<div class="character_container character1"></div>`;
          html += `<div class="vs">vs</div>`;
          html += `<div class="character_container character2"></div>`;
          html += `<div class="name name2"></div>`;
          html += `<div class="p2 score ${p2Class}">${set.Score[1]}</div>`;
        html += `</div>`;

      });

      $(".players_container").html(html);
      // SetInnerHtml($(".players_container"), html);
      console.log("players_container HTML:", $(".players_container").html());

      setTimeout(function(){
        (async function updateSetDetails() {

          console.log("Updating set details...");

          // Helper function to find a player in the player_list by name (tag)
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

          console.log("Player list data:", setHistory.Sets);
          let index = 0;
          for (const set of setHistory.Sets) {

            
            console.log(`Processing set ${index + 1}:`, set);
            console.log("Set: ", set);

            let player1 = findPlayer(data.player_list, set.P1);
            let player2 = findPlayer(data.player_list, set.P2);
            let setContainer = $(".set_container.set" + (index + 1));

            console.log(`setContainer for set ${index + 1}:`, setContainer);
            if (setContainer.length === 0) {
              console.warn(`No set container found for set ${index + 1}`);
            } else {
              console.log(`Successfully found set container for set ${index + 1}`);
            }

            // For testing purposes, print out the outer HTML of the container
            console.log(`Outer HTML for set ${index + 1}:`, setContainer.prop('outerHTML'));

            let p1Container = setContainer.find(".name1")
            let p2Container = setContainer.find(".name2")

            let p1Team = player1 && player1.team ? player1.team : "";
            let p2Team = player2 && player2.team ? player2.team : "";

            let p1Name = player1 ? player1.name : set.P1;
            let p2Name = player2 ? player2.name : set.P2;

            let p1Html = `
              
                ${p1Name}
                <span class="sponsor">${p1Team}</span>`;
            let p2Html = `
              
                <span class="sponsor">${p2Team}</span>
                ${p2Name}`;

            // Update sponsor info if available
            SetInnerHtml(p1Container, p1Html);
            SetInnerHtml(p2Container, p2Html);

            // Update character display for player1
            await CharacterDisplay(
              setContainer.find(".character1"),
              {
                source: `player_list.slot.${player1 ? player1.slotIndex : set.P1}`,
                custom_center: [0.5, 0.5],
                scale_based_on_parent: true
              },
              event
            );
            // Update character display for player2
            await CharacterDisplay(
              setContainer.find(".character2"),
              {
                source: `player_list.slot.${player2 ? player2.slotIndex : set.P2}`,
                custom_center: [0.5, 0.5],
                scale_based_on_parent: true
              },
              event
            );

            index++;

            // Optionally, update additional fields such as avatar, sponsor logos, etc., here if needed
          }
          startingAnimation.restart().then(() => {
            autoScrollPlayers();
          });

        })();
      }, 0);
    });

    $(".container div:has(>.text:empty)").css("margin-right", "0");
    $(".container div:not(:has(>.text:empty))").css("margin-right", "");
    $(".container div:has(>.text:empty)").css("margin-left", "0");
    $(".container div:not(:has(>.text:empty))").css("margin-left", "");

    runOnce = true;
    
    

  };


  let autoScrollTween;

  function autoScrollPlayers() {
    const container = document.querySelector('.players_container');
    if (!container) return;

    // Only clone once: use a data attribute to check if clones already exist.
    if (!container.dataset.cloned) {
      const children = Array.from(container.children);
      children.forEach(child => {
        const clone = child.cloneNode(true);
        container.appendChild(clone);
      });
      container.dataset.cloned = "true";
    }

    // Calculate the height of the original content
  const originalHeight = container.scrollHeight / 2;

    // Suppose you decide on a constant speed (pixels per second)
    const constantSpeed = 100; // pixels per second

    // Calculate duration based on the distance and constant speed:
    const duration = originalHeight / constantSpeed;

    gsap.to(container, {
      duration: duration,
      ease: "none",
      force3D: true,
      scrollTop: "+=" + originalHeight,
      repeat: -1,
      modifiers: {
        scrollTop: function (value) {
          return parseFloat(value) % originalHeight;
        }
      }
    });
  }
  
  
});
