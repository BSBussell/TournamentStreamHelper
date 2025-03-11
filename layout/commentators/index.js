LoadEverything().then(() => {
    if (!window.config) {
        window.config = {
            size: "normal",
        };
    }

    Start = async (event) => {};

    Update = async (event) => {
        let data = event.data;
        let oldData = event.oldData;

        if (
            Object.keys(oldData).length == 0 ||
            Object.keys(oldData.commentary).length !=
                Object.keys(data.commentary).length
        ) {
            let html = "";
            Object.values(data.commentary).forEach((commentator, index) => {
                html += `
                    <div class="commentator_container commentator${index}" style="transform: translateX(100%); opacity: 0; transition: transform 0.5s ease-out;">
                        <div class="name"></div>
                        <div class="pronoun"></div>
                        ${
                            window.config.size == "normal"
                                ? `<div class="real_name"></div>`
                                : ""
                        }
                        ${
                            window.config.size == "normal" ||
                            window.config.size == "mini"
                                ? `<div class="twitter"></div>`
                                : ""
                        }
                    </div>
                `;
            });
            $(".container").html(html);
        }

        for (const [index, commentator] of Object.values(
            data.commentary,
        ).entries()) {
            if (commentator.name) {
                let commentatorElement = $(`.commentator${index}`);
                commentatorElement.css("display", "");

                SetInnerHtml(
                    commentatorElement.find(".name"),
                    `
                        <span class="mic_icon"></span>
                        <span class="team">
                        ${commentator.team ? commentator.team + "&nbsp;" : ""}
                        </span>
                        ${await Transcript(commentator.name)}
                    `,
                );

                twitter_text = "";
                if (commentator.pronoun) {
                    twitter_text += commentator.pronoun.toUpperCase() + " ";
                }
                if (commentator.twitter) {
                    twitter_text += "@" + commentator.twitter;
                }
                SetInnerHtml(commentatorElement.find(".twitter"), twitter_text);

                // Apply animation
                setTimeout(() => {
                    commentatorElement.css({
                        transform: "translateX(0)",
                        opacity: "1",
                    });
                }, index * 200); // Staggered animation for each commentator
            } else {
                $(`.commentator${index}`).css("display", "none");
            }
        }
    };
});
