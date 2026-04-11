LoadEverything().then(() => {
  Start = async (event) => {};

  var hideStagesTimeout = null;

  function GetBannedStages(ruleset, state) {
    let banList = [];

    if (ruleset.useDSR) {
      banList = state.stagesPicked ? state.stagesPicked : [];
    } else if (ruleset.useMDSR && state.lastWinner !== -1) {
      banList =
        state.stagesWon && state.stagesWon.length > 0
          ? state.stagesWon[(state.lastWinner + 1) % 2]
          : [];
    }

    return banList;
  }

  function IsStageBanned(ruleset, state, stage) {
    let banList = GetBannedStages(ruleset, state);

    let found = banList.findIndex((e) => e === stage);
    if (found !== -1) {
      return true;
    }
    return false;
  }

  function IsStageStriked(state, stage, previously = false) {
    for (let i = 0; i < Object.values(state.strikedStages).length; i += 1) {
      if (i === Object.values(state.strikedStages).length - 1 && previously) {
        continue;
      }
      let round = Object.values(state.strikedStages)[i];
      let found = round.findIndex((e) => e === stage);
      if (found !== -1) {
        return true;
      }
    }
    return false;
  }

  function GetStageRows(stages) {
    let rows = [];

    for (let i = 0; i < stages.length; i += 5) {
      rows.push(stages.slice(i, i + 5));
    }

    return rows;
  }

  function GetStageLayout(stageCount) {
    const columns = Math.min(stageCount, 5);
    const rows = Math.max(Math.ceil(stageCount / 5), 1);
    const dockHeight = Math.round(window.innerHeight * 0.25);
    const horizontalPadding = 24;
    const verticalPadding = 28;
    const rowGap = 10;
    const cardGap = 12;
    const availableWidth =
      window.innerWidth - horizontalPadding * 2 - cardGap * (columns - 1);
    const availableHeight = dockHeight - verticalPadding - rowGap * (rows - 1);
    const maxCardWidthFromHeight = Math.floor((availableHeight / rows) * (16 / 9));
    const maxCardWidthFromWidth = Math.floor(availableWidth / columns);
    const cardWidth = Math.max(
      Math.min(maxCardWidthFromHeight, maxCardWidthFromWidth),
      160
    );
    const cardHeight = Math.floor(cardWidth * (9 / 16));

    return {
      dockHeight: dockHeight + "px",
      rowGap: rowGap + "px",
      cardGap: cardGap + "px",
      cardWidth: cardWidth + "px",
      cardHeight: cardHeight + "px",
    };
  }

  async function GetTeamDisplayName(team) {
    let names = [];

    for (const player of Object.values(team.player || {})) {
      if (!player) {
        continue;
      }

      const playerName =
        player.name || player.tag || player.gamerTag || player.display_name || "";

      if (playerName) {
        names.push(await Transcript(playerName));
      }
    }

    if (names.length > 0) {
      return names.join(" / ");
    }

    return team.teamName || "";
  }

  Update = async (event) => {
    let data = event.data;
    let oldData = event.oldData;

    if (
      !oldData.score ||
      JSON.stringify(data.score[window.scoreboardNumber].stage_strike) !=
        JSON.stringify(oldData.score[window.scoreboardNumber].stage_strike) ||
      JSON.stringify(oldData.score[window.scoreboardNumber].team) !=
        JSON.stringify(data.score[window.scoreboardNumber].team)
    ) {
      let html = "";
      let allStages = [];

      try {
        let teamNames = [];

        for (const team of [
          data.score[window.scoreboardNumber].team["1"],
          data.score[window.scoreboardNumber].team["2"],
        ]) {
          teamNames.push(await GetTeamDisplayName(team));
        }

        if (data.score[window.scoreboardNumber].teamsSwapped == true) {
          teamNames = teamNames.reverse();
        }

        allStages = data.score.ruleset.neutralStages;

        if (data.score[window.scoreboardNumber].stage_strike.currGame > 0) {
          allStages = allStages.concat(data.score.ruleset.counterpickStages);
        }

        html = GetStageRows(allStages)
          .map((row) => {
            return `<div class="stage-row">${row
              .map((stage) => {
                let path = stage.path;
                return `
                    <div class="stage-container 
                      ${
                        IsStageStriked(data.score[window.scoreboardNumber].stage_strike, stage.codename) ||
                        IsStageBanned(
                          data.score.ruleset,
                          data.score[window.scoreboardNumber].stage_strike,
                          stage.codename
                        )
                          ? "striked"
                          : ""
                      }
                      ${
                        data.score[window.scoreboardNumber].stage_strike.selectedStage &&
                        data.score[window.scoreboardNumber].stage_strike.selectedStage == stage.codename
                          ? "selected"
                          : ""
                      }
                      ">
                        <div class="stage-icon" style="background-image: url('../../${path}')">
                            ${
                              IsStageStriked(data.score[window.scoreboardNumber].stage_strike, stage.codename)
                                ? `<div class="stage-striked stamp"></div>`
                                : ""
                            }
                            ${
                              IsStageBanned(
                                data.score.ruleset,
                                data.score[window.scoreboardNumber].stage_strike,
                                stage.codename
                              )
                                ? `<div class="stage-dsr stamp"></div>`
                                : ""
                            }
                            ${
                              data.score[window.scoreboardNumber].stage_strike.selectedStage &&
                              data.score[window.scoreboardNumber].stage_strike.selectedStage == stage.codename
                                ? data.score[window.scoreboardNumber].stage_strike.gentlemans
                                  ? `<div class="stage-selected-gentlemans stamp"></div>`
                                  : `<div class="stage-selected stamp"></div>`
                                : ""
                            }
                        </div>
                        <div class="stage-name">
                            <div class="text">
                                ${stage.name}
                            </div>
                        </div>
                        ${
                          IsStageStriked(data.score[window.scoreboardNumber].stage_strike, stage.codename) &&
                          (data.score[window.scoreboardNumber].stage_strike.strikedBy[0].includes(
                            stage.codename
                          ) ||
                            data.score[window.scoreboardNumber].stage_strike.strikedBy[1].includes(
                              stage.codename
                            ))
                            ? `<div class="banned-by-name">
                              <div class="text">
                                ${
                                  data.score[window.scoreboardNumber].stage_strike.strikedBy[0].includes(
                                    stage.codename
                                  )
                                    ? teamNames[0]
                                    : teamNames[1]
                                }
                              </div>
                            </div>`
                            : ""
                        }
                        ${
                          data.score[window.scoreboardNumber].stage_strike.selectedStage &&
                          data.score[window.scoreboardNumber].stage_strike.selectedStage == stage.codename
                            ? `<div class="banned-by-name">
                              <div class="text">
                                ${
                                  data.score[window.scoreboardNumber].stage_strike.gentlemans
                                    ? "Gentlemans"
                                    : teamNames[data.score[window.scoreboardNumber].stage_strike.currPlayer]
                                }
                              </div>
                            </div>`
                            : ""
                        }
                    </div>
                `;
              })
              .join("")}</div>`;
          })
          .join("");

        // Hide stage strike logic
        if (hideStagesTimeout != null) {
          clearTimeout(hideStagesTimeout);
        }

        if (
          window.AUTOHIDE &&
          !_.get(oldData, `score.${window.scoreboardNumber}.stage_strike.selectedStage`) &&
          _.get(data, `score.${window.scoreboardNumber}.stage_strike.selectedStage`)
        ) {
          hideStagesTimeout = setTimeout(() => {
            gsap.to(".container", { autoAlpha: "0" });
          }, 7500);
        }
      } catch (e) {
        console.log(e);
      }
      const stageCount = Math.max(allStages.length, 1);
      const layout = GetStageLayout(stageCount);

      $(".container")
        .css({
          "--dock-height": layout.dockHeight,
          "--row-gap": layout.rowGap,
          "--card-gap": layout.cardGap,
          "--stage-card-width": layout.cardWidth,
          "--stage-card-height": layout.cardHeight,
        })
        .html(html);

      // Fade stage strike back in
      if (!_.get(data, `score.${window.scoreboardNumber}.stage_strike.selectedStage`)) {
        gsap.to(".container", { autoAlpha: "1", overwrite: true });
      }

      $(".container")
        .find(".stage-name, .banned-by-name")
        .each(function () {
          FitText($(this));
        });
    }
  };
});
