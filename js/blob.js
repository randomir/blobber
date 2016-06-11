/**
 * Funky spline-based svg blob lib/editor.
 *
 * Written by Radomir Stevanovic for fun and profit in June 2016.
 * Source: https://github.com/randomir/blobber/.
 */


// first, some math helpers:
function dist2(x1, y1, x2, y2) {
    return Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2);
}
function min(a, b) {
    return a < b ? a : b;
}
function max(a, b) {
    return a > b ? a : b;
}
function clamp(x, m, M) {
    return min(max(x, m), M);
}
function angle(ax, ay, bx, by) {
    var cos = (ax*bx + ay*by) / Math.sqrt(ax*ax + ay*ay) / Math.sqrt(bx*bx + by*by);
    if (isNaN(cos)) cos = 0;
    cos = Math.max(-1, Math.min(cos, 1));
    return Math.acos(cos);
}
function isInsideLineSegment(p1x, p1y, p2x, p2y, x, y) {
    var lx = p2x - p1x, ly = p2y - p1y;
    var ax = p1x - x, ay = p1y - y;
    var bx = p2x - x, by = p2y - y;
    var ang1 = angle(lx, ly, ax, ay);
    var ang2 = angle(lx, ly, bx, by);
    var pi2 = Math.PI/2;
    // oba tupa/siljasta -> izvan; jedan/jedan -> unutar
    return !!((ang1 - pi2) * (ang2 - pi2) < 0);
}


// Blob is bound to paper, everything blob is grouped with <g>
// (inside the paper/<svg>)
var Blob = function(paper) {
    this.paper = paper;
    this.svg = paper.canvas
    this.g = null;
    this.knots = [];
    this.path = null;
    this.tension = null;
    this.pos = null;
    this.$ = {
        box: $(this.svg).parent(),
        svg: $(this.svg),
        g: null,
        path: null,
    };
    this.isActive = false;
    this.isResizing = false;
    this.isMoving = false;
}
$.extend(Blob.prototype, {
    def: {
        // all static styles (visible on export) should be defined here;
        // the dynamic ones are best defined through css
        blobClass: "blob",
        knotAttr: {"class": "blob-knot", stroke: "none"},
        knotRadius: 2,
        pathAttr: {"class": "blob-path", stroke: "none", fill: "rgba(255,0,0,0.7)"},
        tension: 0.6,
        tensionLimit: {min: 0, max: 1.2},
        pos: {x: 0, y: 0},
        // internals
        resizingClass: "resizing",
        activeClass: "active",
        movingClass: "moving",
        activateOnHover: false, // vs. activate with click
        deleteShortcut: false
    },
    
    create: function(initialPoints, initialTension, initialFill, initialPos) {
        this.tension = clamp(
            $.isNumeric(initialTension) ? initialTension : this.def.tension,
            this.def.tensionLimit.min, this.def.tensionLimit.max
        );
        this.pos = initialPos || $.extend({}, this.def.pos);
        
        // create <g> container for knots and curve
        this.g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.$.g = $(this.g);
        this.$.g.addClass(this.def.blobClass).data("blob-ref", this);
        this._translate();
        this.$.svg.append(this.$.g);
        
        // create knots
        for (var i = 0; i < initialPoints.length; i++) {
            var point = initialPoints[i];
            this.createKnot(point[0], point[1]);
        }
        
        // create curved path, draw it
        this.path = this.paper.path("M 0 0").attr(this.def.pathAttr);
        if (initialFill) this.path.attr({fill: initialFill});
        this.$.path = $(this.path.node);
        this.$.path.detach().appendTo(this.$.g);
        this.redrawPath();
        this.bind();
    },
    
    _translate: function() {
        // TODO: move to this.pos setter
        this.$.g.attr({transform: "translate(" + this.pos.x + "," + this.pos.y + ")"});
    },

    getFill: function() {
        return this.path.attr("fill");
    },
    
    setFill: function(rgba) {
        this.path.attr("fill", rgba);
    },

    getTension: function() {
        return Math.round(this.tension*100)/100;
    },
    
    setTension: function(tension) {
        this.tension = clamp(tension, this.def.tensionLimit.min, this.def.tensionLimit.max);
        this.redrawPath();
    },
    
    dump: function() {
        var points = [];
        for (var i = 0; i < this.knots.length; i++) {
            points.push([this.knots[i].attr("cx"), this.knots[i].attr("cy")]);
        }
        return {
            type: "Blob",
            points: points,
            tension: Math.round(this.tension*100)/100,
            fill: this.path.attr("fill"),
            pos: $.extend({}, this.pos)
        };
    },
    
    load: function(data) {
        if (data.type != "Blob") return;
        this.create(data.points, data.tension, data.fill, data.pos);
    },
    
    dumps: function() {
        return JSON.stringify(this.dump());
    },
    
    loads: function(data) {
        this.load(JSON.parse(data));
    },
    
    activate: function() {
        if (this.isActive) return;
        this.$.g.toggleClass(this.def.activeClass, this.isActive = true).trigger("activate");
        this.$.svg.append(this.$.g);
    },

    activateExclusive: function() {
        if (this.isActive) return;
        this.deactivateAllOthers();
        this.activate();
    },
    
    deactivate: function() {
        if (!this.isActive) return;
        this.$.g.toggleClass(this.def.activeClass, this.isActive = false).trigger("deactivate");
    },
    
    deactivateAllOthers: function() {
        $("g.blob", this.$.svg).each(function() {
            $(this).data("blob-ref").deactivate();
        });
    },
    
    // bind DOM event handlers
    bind: function() {
        this.$.svg.on("mousewheel", function(e) {
            if (!this.isActive) return;
            if (e.deltaY < 0) {
                this.tension -= 0.05;
            } else {
                this.tension += 0.05;
            }
            this.tension = clamp(this.tension, this.def.tensionLimit.min, this.def.tensionLimit.max);
            this.redrawPath();
            return false;
        }.bind(this));
        
        this.$.path.on("dblclick", function(e) {
            var coords = this.toClientCoords(e.pageX, e.pageY);
            coords = {cx: coords.cx - this.pos.x, cy: coords.cy - this.pos.y};
            var knotIndices = this.closestLineSegment(coords.cx, coords.cy);
            var i = knotIndices[0], j = knotIndices[1];
            var wraps = (max(i,j) + 1) % this.knots.length == min(i,j);
            this.createKnot(coords.cx, coords.cy, !wraps && max(i, j));
            this.redrawPath();
        }.bind(this));
        
        // deactivate all blobs on canvas click
        this.$.svg.on("mousedown", function(e) {
            if (e.eventPhase == Event.AT_TARGET) {
                // in activate-by-click mode, deactivate the active blob
                if (!this.def.activateOnHover) this.deactivateAllOthers();
            }
            // prevent text select on dblclick
            return false;
        }.bind(this));
        
        // activate/deactivate by click
        this.$.g.on("mousedown", function(e) {
            if (!this.def.activateOnHover) {
                this.activateExclusive();
            }
        }.bind(this));

        // activate/deactivate by hover
        this.$.g.on("mouseenter", function(e) {
            if (e.which > 0) return;
            if (this.def.activateOnHover) this.activate();
        }.bind(this));
        
        this.$.g.on("mouseleave", function(e) {
            if (this.isResizing) return;
            if (this.def.activateOnHover) this.deactivate();
        }.bind(this));

        // blob move/drag
        var _beginDragPos;
        this.$.g.on("mousedown", function(e) {
            if (this.isResizing) return;
            this.$.g.toggleClass(this.def.movingClass, this.isMoving = true);
            _beginDragPos = this.toClientCoords(e.pageX, e.pageY);
        }.bind(this));

        this.$.svg.on("mousemove", function(e) {
            if (!this.isMoving) return;
            var coords = this.toClientCoords(e.pageX, e.pageY);
            this.pos.x += coords.cx - _beginDragPos.cx;
            this.pos.y += coords.cy - _beginDragPos.cy;
            this._translate();
            _beginDragPos = coords;
        }.bind(this));
        
        $(document).on("mouseup", function(e) {
            this.$.g.toggleClass(this.def.movingClass, this.isMoving = false);
        }.bind(this));
        
        // blob delete
        $(document).on("keyup", function(e) {
            if (this.def.deleteShortcut && this.isActive && e.which == 46) {
                this.$.g.remove();
            }
        }.bind(this));
    },
    
    bindKnotEvents: function(knot) {
        // in raphael event handlers we must let raphael bind `this`,
        // otherwise we lose reference to raphael target
        var me = this;
        
        // raphael event handler triggered for knot move;
        knot.drag(function(dx, dy, x, y) {
            // onmove:
            var coords = me.toClientCoords(x, y);
            this.attr({cx: coords.cx - me.pos.x, cy: coords.cy - me.pos.y});
            me.redrawPath();
        }, function() {
            // onstart
            me.$.g.toggleClass(me.def.resizingClass, me.isResizing = true);
        }, function() {
            // onend
            me.$.g.toggleClass(me.def.resizingClass, me.isResizing = false);
        });
        
        // raphael event handler triggered for knot removal
        knot.dblclick(function(dx, dy, x, y) {
            if (me.knots.length <= 3) return;
            for (var i = 0; i < me.knots.length; i++) {
                if (me.knots[i] == this) {
                    this.remove();
                    me.knots.splice(i, 1);
                    break;
                }
            }
            me.redrawPath();
        });
    },
    
    // create and insert into knots at pos idx
    createKnot: function(x, y, idx) {
        var knot = this.paper.circle(x, y, this.def.knotRadius).attr(this.def.knotAttr);
        $(knot.node).detach().appendTo(this.$.g);
        this.bindKnotEvents(knot);
        if (idx) {
            this.knots.splice(idx, 0, knot);
        } else {
            this.knots.push(knot);
        }
        return knot;
    },
    
    // render curved path between the knots
    redrawPath: function() {
        if (this.knots.length < 3) return;
        
        // close the path by adding first/last knot to end/beginning
        var kts = this.knots.slice();
        kts.push(kts[0]);
        kts.unshift(kts[kts.length-2]);

        var pts = [];
        for (var i = 0; i < kts.length; i++) {
            pts.push(kts[i].attr("cx"), kts[i].attr("cy"));
        }

        var cps = [];
        for (var i = 0; i <= pts.length-6; i += 2) {
            var cp = this.getControlPoints(
                pts[i], pts[i+1], pts[i+2], pts[i+3],
                pts[i+4], pts[i+5], this.tension
            );
            cps = cps.concat(cp);
        }
        cps.push(cps[0], cps[1]);

        var pathCode = ["M", pts[2], pts[3]];
        for (var i = 2; i <= pts.length-4; i += 2) {
            pathCode.push("C", cps[2*i-2], cps[2*i-1], cps[2*i], cps[2*i+1], pts[i+2], pts[i+3]);
        }
        pathCode.push("Z");
        
        this.path.attr({path: pathCode.join(" ")}).toBack();
    },
    
    toClientCoords: function(x, y) {
        var offset = this.$.box.offset();
        return {cx: x - offset.left, cy: y - offset.top};
    },

    closestLineSegment: function(x, y) {
        var n = this.knots.length;
        var minDist = 1e10, minLeft = -1, minRight = -1;
        for (var idxLeft = 0; idxLeft < n; idxLeft++) {
            var idxRight = (idxLeft + 1) % n;
            var p1 = this.knots[idxLeft], p2 = this.knots[idxRight];
            var p1x = p1.attr("cx"), p1y = p1.attr("cy");
            var p2x = p2.attr("cx"), p2y = p2.attr("cy");
            if (!isInsideLineSegment(p1x, p1y, p2x, p2y, x, y)) {
                continue;
            }
            var d = Math.pow((p2y - p1y) * x - (p2x - p1x) * y + p2x * p1y - p2y * p1x, 2)
                  / (Math.pow(p2y - p1y, 2) + Math.pow(p2x - p1x, 2));
            if (d < minDist) {
                minDist = d;
                minLeft = idxLeft;
                minRight = idxRight;
            }
        }
        return [minLeft, minRight];
    },
    
    // natural bezier spline interp between series of points
    // see: http://scaledinnovation.com/analytics/splines/aboutSplines.html
    getControlPoints: function(x0, y0, x1, y1, x2, y2, t) {
        var d01 = Math.sqrt(Math.pow(x1-x0,2) + Math.pow(y1-y0,2));
        var d12 = Math.sqrt(Math.pow(x2-x1,2) + Math.pow(y2-y1,2));
        var fa = t*d01/(d01+d12);
        var fb = t-fa;
        var p1x = x1+fa*(x0-x2);
        var p1y = y1+fa*(y0-y2);
        var p2x = x1-fb*(x0-x2);
        var p2y = y1-fb*(y0-y2);  
        return [p1x, p1y, p2x, p2y];
    }

});
