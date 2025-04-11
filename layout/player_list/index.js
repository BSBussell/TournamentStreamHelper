LoadEverything().then(() => {
  gsap.config({ nullTargetWarn: false, trialWarn: false });

  let startingAnimation = gsap
    .timeline({ paused: true })
    .from([".container"], { duration: 1, width: "0", ease: "power2.inOut" }, 0);

  Start = async (event) => {
    startingAnimation.restart();
  };

  Update = async (event) => {
    let data = event.data;
    let oldData = event.oldData;

    if (
      !oldData.player_list ||
      JSON.stringify(data.player_list) != JSON.stringify(oldData.player_list)
    ) {
      let html = "";

      const teams = Object.values(data.player_list.slot).sort(() => Math.random() - 0.5);
      teams
      .forEach((slot, i) => {
        html += `<div class="slot slot${i + 1}">`;
        html += `<div class="container heading_title">Fun Facts can go here?</div>`;
        Object.values(slot.player).forEach((player, p) => {
          html += `
            <div class="p${p + 1} player container">
             
              <div class="name_twitter">
                <div class="name"></div>
                <div class="twitter"></div>
                </div>
              <div class="filler"></div>
              <div class="character_container"></div>
            </div>
          `;
        });
        html += "</div>";
      });

      $(".players_container").html(html);

      
      for (const [t, slot] of teams.entries()) {
        SetInnerHtml($(`.slot${t + 1} .title`), slot.name);
        const players = Object.values(slot.player);
        for (const [p, player] of players.entries()) {
          if (player) {
            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .name`),
              `
            <span>
              <span class="sponsor">
                ${player.team ? player.team : ""}
              </span>
              ${await Transcript(player.name)}
            </span>
            `,
              undefined,
              0
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .flagcountry`),
              player.country.asset
                ? `<div class='flag' style='background-image: url(../../${player.country.asset.toLowerCase()})'></div>`
                : "",
              undefined,
              0
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .flagstate`),
              player.state.asset
                ? `<div class='flag' style='background-image: url(../../${player.state.asset})'></div>`
                : "",
              undefined,
              0
            );

            await CharacterDisplay(
              $(`.slot${t + 1} .p${p + 1}.container .character_container`),
              {
                source: `player_list.slot.${t + 1}.player.${p+1}`,
                custom_center: [0.5, 0.5],
                scale_based_on_parent: true,
              },
              event
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .sponsor_icon`),
              player.sponsor_logo
                ? `<div style='background-image: url(../../${player.sponsor_logo})'></div>`
                : "",
              undefined,
              0
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .avatar`),
              player.avatar
                ? `<div style="background-image: url('../../${player.avatar}')"></div>`
                : "",
              undefined,
              0
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .online_avatar`),
              player.online_avatar
                ? `<div style="background-image: url('${player.online_avatar}')"></div>`
                : "",
              undefined,
              0
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .twitter`),
              player.twitter
                ? `<span class="twitter_logo"></span>${String(player.twitter)}`
                : "",
              undefined,
              0
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .sponsor-container`),
              `<div class='sponsor-logo' style='background-image: url(../../${player.sponsor_logo})'></div>`,
              undefined,
              0
            );
          }
        }
      }
    }

    $(".container div:has(>.text:empty)").css("margin-right", "0");
    $(".container div:not(:has(>.text:empty))").css("margin-right", "");
    $(".container div:has(>.text:empty)").css("margin-left", "0");
    $(".container div:not(:has(>.text:empty))").css("margin-left", "");

    autoScrollPlayers();
  };

  function autoScrollPlayers() {
    const container = document.querySelector('.players_container');
    if (!container) return;
  
    // Clone the children to create a seamless scrolling effect
    // This duplicates the content so that when we wrap, the same visuals continue
    const children = Array.from(container.children);
    children.forEach(child => {
      const clone = child.cloneNode(true);
      container.appendChild(clone);
    });
  
    // Calculate the height of the original content
    const originalHeight = container.scrollHeight / 2;
  
    // Animate the container's scrollTop property continuously.
    // The modifiers plugin ensures the value resets seamlessly.
    gsap.to(container, {
      duration: 30,
      ease: "none",
      // Animate an increment of the original height
      scrollTop: "+=" + originalHeight,
      repeat: -1,
      modifiers: {
        scrollTop: function(value) {
          // Use the modulus operator to wrap the scroll position
          return parseFloat(value) % originalHeight;
        }
      }
    });
  }
});
