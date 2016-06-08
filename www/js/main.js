// natural bezier spline interp between series of points
// http://scaledinnovation.com/analytics/splines/aboutSplines.html
function getControlPoints(x0,y0,x1,y1,x2,y2,t){
    //  x0,y0,x1,y1 are the coordinates of the end (knot) pts of this segment
    //  x2,y2 is the next knot -- not connected here but needed to calculate p2
    //  p1 is the control point calculated here, from x1 back toward x0.
    //  p2 is the next control point, calculated here and returned to become the 
    //  next segment's p1.
    //  t is the 'tension' which controls how far the control points spread.
    
    //  Scaling factors: distances from this knot to the previous and following knots.
    var d01=Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
    var d12=Math.sqrt(Math.pow(x2-x1,2)+Math.pow(y2-y1,2));
   
    var fa=t*d01/(d01+d12);
    var fb=t-fa;
  
    var p1x=x1+fa*(x0-x2);
    var p1y=y1+fa*(y0-y2);

    var p2x=x1-fb*(x0-x2);
    var p2y=y1-fb*(y0-y2);  
    
    return [p1x,p1y,p2x,p2y];
}

function dist2(x1, y1, x2, y2) {
    return Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2);
}

function min(a, b) {
    return a < b ? a : b;
}
function max(a, b) {
    return a > b ? a : b;
}


$(function() {
    var canvas = Raphael("blob", 800, 800);
    var initialPoints = [[400, 200], [600, 400], [400, 600], [200, 400]], pointRadius = 5,
        pointAttr = {fill: "#f00", stroke: "#000", "stroke-width": 3},
        curveAttr = {fill: "#f00", stroke: "#000", "stroke-width": 3},
        knots = [];
    var curve;
    var tension = 1;

    // handle knot move
    function knotMove(dx, dy, x, y, evt) {
        this.attr({cx: evt.offsetX, cy: evt.offsetY});
        redrawPath();
    }
    function knotRemove(dx, dy, x, y, evt) {
        for (var i = 0; i < knots.length; i++) {
            if (knots[i] == this) {
                this.remove();
                knots.splice(i, 1);
                break;
            }
        }
        redrawPath();
    }

    // render curve between knots
    var pts = [];
    function redrawPath() {
        if (knots.length < 3) return;
        // close the path by adding first/last knot to end/beginning
        var kts = knots.slice();
        kts.push(kts[0]);
        kts.unshift(kts[kts.length-2]);

        pts = [];
        for (var i = 0; i < kts.length; i++) {
            pts.push(kts[i].attr("cx"), kts[i].attr("cy"));
        }

        var cps = [];
        for (var i = 0; i <= pts.length-6; i += 2) {
            cps = cps.concat(getControlPoints(pts[i], pts[i+1], pts[i+2], pts[i+3], pts[i+4], pts[i+5], tension));
        }
        cps.push(cps[0], cps[1]);

        var path = ["M", pts[2], pts[3]];
        for (var i = 2; i <= pts.length-4; i += 2) {
            path.push("C", cps[2*i-2], cps[2*i-1], cps[2*i], cps[2*i+1], pts[i+2], pts[i+3]);
        }
        path.push("Z");
        curve.attr({path: path.join(" ")}).toBack();
    }

    function closestKnot(x, y) {
        var minDist = 1e10, minIdx = -1;
        for (var i = 0; i < knots.length; i++) {
            var xi = knots[i].attr("cx"), yi = knots[i].attr("cy"), d = dist2(x, y, xi, yi);
            if (d < minDist) {
                minDist = d;
                minIdx = i;
            }
        }
        if (minIdx < 0) return;
        return minIdx;
    }

    function nextClosestKnot(idx, x, y) {
        var n = knots.length;
        var next = (idx + 1) % n;
        var prev = (idx - 1 + n) % n;
        if (dist2(x, y, knots[prev].attr("cx"), knots[prev].attr("cy")) < 
            dist2(x, y, knots[next].attr("cx"), knots[next].attr("cy"))) {
            return prev;
        } else {
            return next;
        }
    }

    // create and insert into knots at pos idx
    function createKnot(x, y, idx) {
        var knot = canvas.circle(x, y, pointRadius).attr(pointAttr);
        knot.drag(knotMove);
        knot.dblclick(knotRemove);
        if (idx) {
            knots.splice(idx, 0, knot);
        } else {
            knots.push(knot);
        }
        return knot;
    }

    // create knots, draw them on canvas
    for (var i = 0; i < initialPoints.length; i++) {
        var point = initialPoints[i];
        createKnot(point[0], point[1]);
    }

    curve = canvas.path("M 0 0").attr(curveAttr);

    redrawPath();

    $("#blob").on("mousewheel", function(e) {
        if (e.deltaY < 0) {
            tension -= 0.1;
        } else {
            tension += 0.1;
        }
        redrawPath();
    });

    $("#blob path").on("dblclick", function(e) {
        var x = e.offsetX, y = e.offsetY;
        var i = closestKnot(x, y);
        var j = nextClosestKnot(i, x, y);
        var wraps = (max(i,j) + 1) % knots.length == min(i,j);
        createKnot(x, y, !wraps && max(i, j));
        redrawPath();
    });
});
