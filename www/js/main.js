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


$(function() {
    var canvas = Raphael("blob", 800, 800);
    var points = [[400, 200], [600, 400], [400, 600], [200, 400]], pointRadius = 5,
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

    // render curve between knots
    function redrawPath() {
        if (knots.length < 5) return;
        var pts = [];
        for (var i = 0; i < knots.length; i++) {
            pts.push(knots[i].attr("cx"), knots[i].attr("cy"));
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

    // create knots, draw them on canvas
    for (var i = 0; i < points.length; i++) {
        var point = points[i];
        var knot = canvas.circle(point[0], point[1], pointRadius).attr(pointAttr);
        knot.drag(knotMove);
        knots.push(knot);
    }
    // close the path by adding first/last knot to end/beginning
    knots.push(knots[0]);
    knots.unshift(knots[knots.length-2]);

    curve = canvas.path("M 0 0").attr(curveAttr);

    redrawPath();

});
