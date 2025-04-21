// Customize the name of the points
const CHANNEL_POINTS_NAME = "GLRA GYMMS";


LoadEverything().then(() => {

    let expandAnimation = gsap
        .timeline({ paused: true })
        .from([".prediction-overlay"], { duration: 1, opacity: 0, width: "50%", ease: "power2.inOut" }, 0)
        
        // Fix my messy css
        .from([".bar-left-slant"], { duration: 0.5, opacity: 0, x: 25, skewX: 0, ease: "power2.inOut" }, 0.6)
        .from([".bar-right-slant"], { duration: 0.5, opacity: 0, x: -25, skewX: 0, ease: "power2.inOut" }, 0.6)

        // .from([".bar-left-slant", ".bar-right-slant"], { duration: 0.8, opacity: 0, x: 20, ease: "power2.out" }, 0.25)
        .to([".prediction-overlay"], { duration: 1, opacity: 1, ease: "power2.inOut" }, 0);
     
    let updateTextAnimation = gsap
    .timeline({ paused: true })
    .fromTo([".p1-score", ".p2-score"], 
        { rotationX: -90, transformOrigin: "top center", opacity: 0 },
        { duration: 0.6, rotationX: 0, opacity: 1, ease: "back.out(2.7)" }, 
        0)
    .fromTo(["#left-percent", "#right-percent"], 
        { rotationX: -90, transformOrigin: "top center", opacity: 0 },
        { duration: 0.6, rotationX: 0, opacity: 1, ease: "back.out(2.7)" }, 
        0);


    
    let old_json = null;

    let stored_data;
    
    Start = async (event) => {
        expandAnimation.play();
        pollPredictionInfo();
    };

    let lastPredictionInfo = null;

    Update = async (event) => {
        if (JSON.stringify(stored_data) !== JSON.stringify(event.data)) {
            lastPredictionInfo = null; // Force prediction info update for side switch
        }
        stored_data = event.data;
    }

    function onPredictionInfoChanged(predictionInfo) {

        
        // Open ../prediction_info.json
        // let predictionInfo = await fetch("./PythonScripts/prediction_info.json");
        // predictionInfo = await predictionInfo.json();
        
        // // Check if the predictionInfo has changed
        // if (JSON.stringify(predictionInfo) === JSON.stringify(old_json)) {
        //     return;
        // }
        // old_json = predictionInfo;
        
        console.log(predictionInfo);
        
        // Get the outcomes
        let outcomes = predictionInfo.outcomes;
        let player1 = outcomes[0].title;
        let player2 = outcomes[1].title;

        // Check if player names match scoreboard names from data
        console.log(stored_data.score["1"]);
        let TSH_P1 = stored_data.score["1"].team["1"].player["1"]
        let TSH_P2 = stored_data.score["1"].team["2"].player["1"]
        
        let p1_index = 0;
        let p2_index = 1;

        if (player1 == TSH_P2.name) {
            player1 = TSH_P1.name;
            player2 = TSH_P2.name;
            p1_index = 1;
            p2_index = 0;

        }

        // Add sponsor to name as span
        if (TSH_P1.team) {
            player1 = `${player1}<span class="sponsor">${TSH_P1.team}</span>`;
        }
        if (TSH_P2.team) {
            player2 = `<span class="sponsor">${TSH_P2.team}</span>${player2}`;
        }

        

        // Populate the player names
        let player1Name = document.querySelector("#p1-name");
        let player2Name = document.querySelector("#p2-name");
        
        if (!window.hide_names) {
            console.log("Setting player names");
            SetInnerHtml($("#p1-name"), player1);
            SetInnerHtml($("#p2-name"), player2);
        }

        let player1Points = outcomes[p1_index].channel_points;
        let player2Points = outcomes[p2_index].channel_points;

        // Get Prediction Window
        let predictionWindow = predictionInfo.duration;
        let predictionWindowStart = predictionInfo.creation_time;

        // Build point string with commas
        let player1PointsString = player1Points.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        let player2PointsString = player2Points.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        
        let player1Percent = Math.round((player1Points / (player1Points + player2Points)) * 100);
        let player2Percent = Math.round((player2Points / (player1Points + player2Points)) * 100);

        
        
        let player1PercentString = player1Percent.toString() + "%";
        let player2PercentString = (player2Percent != 0) ? player2Percent.toString() + "%" : '';

        // If the percents are nan, set them to 0
        if (player1Points + player2Points == 0) {
            // player1Percent = 0;
            player1Percent = 50;
            player1PercentString = "0%";
            player2Percent = 50;
            player2PercentString = "0%";
        }

        // Hiding things
        if (window.hide_points) {
            player1PointsString = "";
            player2PointsString = "";
        }

        if (window.hide_percent) {
            player1PercentString = "";
            player2PercentString = "";
        }

        if (window.bar_only) {
            // Set prediction-names display to none
            let predictionNames = document.querySelector(".prediction-names");
            predictionNames.style.display = "none";
        }

        console.log(window);

        // Get player1 and player2 elements
        let player1Element = document.querySelector(".p1-score");
        let player2Element = document.querySelector(".p2-score");

        

        // Set the player1 and player2 elements to the player1 and player2 points
        player1Element.innerHTML = [...player1PointsString].map(char => `<span>${char}</span>`).join("");
        player2Element.innerHTML = [...player2PointsString].map(char => `<span>${char}</span>`).join("");

        // Get both gims elements by looping through the elements
        // let gimsElements = document.querySelectorAll(".gims");
        // gimsElements.forEach((element) => {
        //     element.innerHTML = CHANNEL_POINTS_NAME;
        // });

        // set left and right percent
        let leftPercent = document.querySelector("#left-percent");
        let rightPercent = document.querySelector("#right-percent");

        leftPercent.innerHTML = player1PercentString;
        rightPercent.innerHTML = player2PercentString;

        

        // Get the bar-left and bar-right elements
        let barLeft = document.querySelector(".bar-left");
        let barRight = document.querySelector(".bar-right");

        // Modify the class with the leading class
        if (player1Points > player2Points) {
            barLeft.classList.add("leading");
            barRight.classList.remove("leading");
        } else if (player2Points > player1Points) {
            barRight.classList.add("leading");
            barLeft.classList.remove("leading");
        } else {
            barLeft.classList.remove("leading");
            barRight.classList.remove("leading");
        }

        // Set width of the bars
        barLeft.style.width = player1Percent + "%";
        barRight.style.width = player2Percent + "%";


        // Animate the text changes
        updateTextAnimation.restart();

        // Kill previous animations and reset
        // let chars = document.querySelectorAll(".p1-score span, .p2-score span");
        // gsap.killTweensOf(chars);

        // let snakeTimeline = gsap.timeline({ repeat: -1 });
        // chars.forEach((char, index) => {
        //   snakeTimeline.to(char, {
        //     y: -8,
        //     duration: 0.6,
        //     ease: "sine.inOut",
        //     yoyo: true,
        //     repeat: 1
        //   }, index * 0.1); // Increase stagger for smoother wave
        // });

    };

    

    async function pollPredictionInfo() {
        try {
            const response = await fetch("./PythonScripts/prediction_info.json", { cache: "no-store" });
            const predictionInfo = await response.json();

            if (JSON.stringify(predictionInfo) !== JSON.stringify(lastPredictionInfo)) {
                lastPredictionInfo = predictionInfo;
                onPredictionInfoChanged(predictionInfo);
            }
        } catch (e) {
            console.error("Error polling prediction_info.json:", e);
        }
    }

    

    setInterval(pollPredictionInfo, 200); // check every 5 seconds

});