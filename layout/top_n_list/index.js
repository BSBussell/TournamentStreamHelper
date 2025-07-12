LoadEverything().then(() => {
  gsap.config({ nullTargetWarn: false, trialWarn: false });

  let startingAnimation = gsap
    .timeline({ paused: true })
    .from([".container"], { duration: 1, ease: "power2.inOut" }, 0);

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
	let htmls = [];
	let firstpass = new Array();
	let nbtimes = 2;
	for(let e=0;e<data.tournamentInfo.numEntrants/2;e++){
		for(let j=0;j<nbtimes;j++){
			firstpass.push(e)
		}
		e += nbtimes;
		for(let j=0;j<nbtimes;j++){
			firstpass.push(e)
		}
		e += nbtimes-1;
		nbtimes *=2
	}
	let standing = new Array(1,2,3,4,5,6,7,8,9,10, 'TS', 'BC', 'TM', 'V');
	// standing = standing.concat(firstpass.map((e)=>e+5));
	for (const [i, slot] of Object.entries(data.player_list.slot)) {
        let html = `<div class="slot slot${i + 1}">`;
        for (const [p, player] of Object.entries(slot.player)) {
          html += `
            <div class="p${p + 1} player container">
              <div class="score">${
                standing[
                  i - 1
                ]
              }</div>
              <div class="icon avatar"></div>
              <div class="icon online_avatar"></div>
              <div class="name_twitter">
              <div class="name"></div>
              <div class="twitter"></div>
              </div>
              <div class="sponsor_icon"></div>
              <div class="flags">
                <div class="flagcountry"></div>
                ${player.state.asset ? `<div class="flagstate"></div>` : ""}
              </div>
              <div class="filler"></div>
              <div class="character_container"></div>
            </div>
          `;
        }

        html += "</div>";

        htmls.push(html);
      }

      $(".players_container").html("");

      for (let i = 0; i < htmls.length; i++) {
        let html = htmls[i];
        $(".players_container").html($(".players_container").html() + html);
      }

      for (const [t, slot] of Object.entries(data.player_list.slot)) {
        SetInnerHtml($(`.slot${parseInt(t) + 1} .title`), slot.name);
        for (const [p, player] of Object.entries(slot.player)) {
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
                ? `
                  <div class='flag' style='background-image: url(../../${String(
                    player.country.asset
                  ).toLowerCase()})'></div>
                  <div class='flagname'>${player.country.code}</div>
                ` 
                : "",
              undefined,
              0
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .flagstate`),
              player.state.asset
                ? `
                  <div class='flag' style='background-image: url(../../${player.state.asset})'></div>
                  <div class='flagname'>${player.state.code}</div>
                `
                : "",
              undefined,
              0
            );

            await CharacterDisplay(
              $(`.slot${t + 1} .p${p + 1}.container .character_container`),
              {
                source: `player_list.slot.${t}`,
                scale_based_on_parent: true,
              },
              event
            );

            SetInnerHtml(
              $(`.slot${t + 1} .p${p + 1}.container .sponsor_icon`),
              player.sponsor_logo
                ? `<div style='background-image: url(../../${player.sponsor_logo})'></div>`
                : "<div></div>",
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
                : '<div style="background: gray)"></div>',
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

        gsap.from(
          $(`.slot${t + 1}`),
          { x: -100, autoAlpha: 0, duration: 0.3, delay: 0 },
          0.5 + 0.2 * t
        );

        
        
      }

      const $el = $(`.Titles`);
        const baseDelay = 0.5 + 0.2 * 14;

        gsap.fromTo(
            $el,
            {
                y: 300, // rise from below screen
                autoAlpha: 0,
                scale: 0.8,
            },
            {
                y: -20, // rise up to just above landing point
                autoAlpha: 1,
                scale: 1.1,
                duration: 0.4,
                ease: "power4.out",
                delay: baseDelay,
                onComplete: () => {
                    gsap.to($el, {
                        y: 0,
                        scale: 0.95,
                        duration: 0.1,
                        ease: "power2.in",
                        onComplete: () => {
                            gsap.to($el, {
                                scale: 1,
                                duration: 0.15,
                                ease: "elastic.out(1, 0.4)",
                                onComplete: () => {
                                    gsap.to($el, {
                                        x: "+=3",
                                        y: "-=2",
                                        duration: 0.05,
                                        repeat: 3,
                                        yoyo: true,
                                        ease: "power1.inOut",
                                    });
                                },
                            });
                        },
                    });
                },
            }
        );
    }
  };
});
