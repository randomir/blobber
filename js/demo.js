var paper;

$(function() {
    function addRandomBlob() {
        var blob = new Blob(paper);
        var tension = Math.round(Math.random()*10)/10;
        var color = "rgba(255,0,0," + Math.round(Math.random()*9+1)/10 + ")";
        var initialPoints = [[0, -200], [200, 0], [0, 200], [-200, 0]];
        blob.create(initialPoints, tension, color, {x: 400, y: 400});
    }

    function exportToSVG() {
        window.open("data:image/svg+xml," + encodeURIComponent($("#blobs").html()));
    }
    
    function exportToJSON() {
        var blobs = [];
        $("#blobs g.blob").each(function() {
            blobs.push($(this).data("object").dump());
        });
        window.open(window.location.origin + "#" + encodeURIComponent(JSON.stringify(blobs)));
    }
    
    function loadFromURIHash(hash) {
        var blobs = JSON.parse(decodeURIComponent(String(hash).replace(/^#/, "")));
        if (!$.isArray(blobs)) return;
        for (var i = 0; i < blobs.length; i++) {
            var blob = new Blob(paper);
            blob.load(blobs[i]);
        }
    }
    
    $("#add").click(addRandomBlob);
    $("#export-svg").click(exportToSVG);
    $("#export-json").click(exportToJSON);
    
    paper = Raphael("blobs", 800, 800);
    if (window.location.hash) {
        loadFromURIHash(window.location.hash);
    } else {
        addRandomBlob();
    }
});
