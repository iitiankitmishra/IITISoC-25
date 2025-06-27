function generateDiagram() {
    let beamLength = parseFloat(document.getElementById("beamLength").value);
    let force = parseFloat(document.getElementById("force1").value);
    let position = parseFloat(document.getElementById("position1").value);

    if (isNaN(beamLength) || isNaN(force) || isNaN(position)) {
        alert("Please enter valid inputs.");
        return;
    }

    let shearForces = [];
    let bendingMoments = [];
    let xLabels = [];

    for (let x = 0; x <= beamLength; x++) {
        xLabels.push(x);
        if (x < position) {
            shearForces.push(0);
            bendingMoments.push(0);
        } else {
            shearForces.push(-force);
            bendingMoments.push(force * (x - position));
        }
    }

    drawChart("sfdChart", "Shear Force", xLabels, shearForces, "red");
    drawChart("bmdChart", "Bending Moment", xLabels, bendingMoments, "blue");
}


function drawChart(canvasId, label, xLabels, data, color) {
    let ctx = document.getElementById(canvasId).getContext("2d");
    new Chart(ctx, {
        type: "line",
        data: {
            labels: xLabels,
            datasets: [{
                label: label,
                data: data,
                borderColor: color,
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: "Beam Length" } },
                y: { title: { display: true, text: label + " Value" } }
            }
        }
    });
}
